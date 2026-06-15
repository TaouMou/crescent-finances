/**
 * Vault store: the single source of truth for lock/unlock state on the main
 * thread. It NEVER holds the derived key — that lives only in the worker. Here
 * we keep the status, the last error, and the KDF material needed to unlock.
 */

import { get, writable } from 'svelte/store';
import { cryptoWorker } from '$lib/workers/cryptoClient';
import { configRepo, vaultRepo, type VaultMaterial } from '$lib/db/repos';
import { emptyConfig, type ParsedConfig } from '$lib/config/schema';
import type { AppConfig } from '$lib/types';
import { vaultTransition, type VaultStatus } from './vault-machine';

export interface VaultState {
  status: VaultStatus;
  /** Last user-facing error, e.g. wrong passphrase. */
  error: string | null;
  material: VaultMaterial | null;
}

const initial: VaultState = { status: 'loading', error: null, material: null };

function createVaultStore() {
  const store = writable<VaultState>(initial);
  const { subscribe, update } = store;

  function status(): VaultStatus {
    return get(store).status;
  }

  /** Determine, on boot, whether a vault already exists. */
  async function init(): Promise<void> {
    const exists = await vaultRepo.isInitialized();
    const material = exists ? await vaultRepo.getMaterial() : null;
    update((s) => ({
      ...s,
      status: vaultTransition(s.status, { type: 'checked', exists }),
      material
    }));
  }

  /** First-run: choose a passphrase, derive the key, persist the material. */
  async function setup(passphrase: string): Promise<void> {
    const res = await cryptoWorker.setup(passphrase);
    const material: VaultMaterial = {
      saltB64: res.saltB64,
      iterations: res.iterations,
      verifier: res.verifier
    };
    await vaultRepo.saveMaterial(material);
    // Persist an empty config so the app has something to render against.
    if (!(await configRepo.get())) await configRepo.save(emptyConfig());
    update((s) => ({
      ...s,
      status: vaultTransition(s.status, { type: 'setupDone' }),
      error: null,
      material
    }));
  }

  /** Unlock an existing vault. Returns true on success. */
  async function unlock(passphrase: string): Promise<boolean> {
    const material = get(store).material ?? (await vaultRepo.getMaterial());
    if (!material) {
      update((s) => ({ ...s, error: 'No vault found on this device.' }));
      return false;
    }
    update((s) => ({ ...s, status: vaultTransition(s.status, { type: 'unlockStart' }), error: null }));
    const { ok } = await cryptoWorker.unlock({
      passphrase,
      saltB64: material.saltB64,
      iterations: material.iterations,
      verifier: material.verifier
    });
    update((s) => ({
      ...s,
      status: vaultTransition(s.status, { type: ok ? 'unlockOk' : 'unlockFail' }),
      error: ok ? null : 'That passphrase did not match. Try again.',
      material
    }));
    return ok;
  }

  async function lock(): Promise<void> {
    await cryptoWorker.lock();
    update((s) => ({ ...s, status: vaultTransition(s.status, { type: 'lock' }), error: null }));
  }

  /** Forget everything on this device (irreversible). */
  async function reset(): Promise<void> {
    await vaultRepo.reset();
    cryptoWorker.terminate();
    update((s) => ({ ...s, status: vaultTransition(s.status, { type: 'reset' }), error: null, material: null }));
  }

  return { subscribe, init, setup, unlock, lock, reset, status };
}

export const vault = createVaultStore();

// Re-export for convenience at call sites.
export type { AppConfig, ParsedConfig };
