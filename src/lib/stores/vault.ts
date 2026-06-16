/**
 * Vault store: the single source of truth for lock/unlock state on the main
 * thread. It NEVER holds the derived key — that lives only in the worker. Here
 * we keep the status, the last error, the KDF material needed to unlock, and the
 * "remember on this device" preference + idle auto-lock.
 */

import { get, writable } from 'svelte/store';
import { cryptoWorker } from '$lib/workers/cryptoClient';
import { configRepo, vaultRepo, type VaultMaterial } from '$lib/db/repos';
import { emptyConfig, type ParsedConfig } from '$lib/config/schema';
import type { AppConfig } from '$lib/types';
import { vaultTransition, type VaultStatus } from './vault-machine';

/** Auto-lock after this much inactivity (also the max age of a remembered key). */
export const IDLE_MS = 15 * 60 * 1000;
const REMEMBER_KEY = 'crescent.remember';
const TOUCH_THROTTLE_MS = 60 * 1000;

export interface VaultState {
  status: VaultStatus;
  /** Last user-facing error, e.g. wrong passphrase. */
  error: string | null;
  material: VaultMaterial | null;
  /** "Keep me unlocked on this device" preference. */
  remember: boolean;
}

function readRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

const initial: VaultState = {
  status: 'loading',
  error: null,
  material: null,
  remember: readRemember()
};

function createVaultStore() {
  const store = writable<VaultState>(initial);
  const { subscribe, update } = store;

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTouch = 0;
  let listening = false;

  function status(): VaultStatus {
    return get(store).status;
  }

  // --- idle auto-lock -------------------------------------------------------

  function onActivity() {
    armIdleTimer();
    const now = Date.now();
    if (get(store).remember && now - lastTouch > TOUCH_THROTTLE_MS) {
      lastTouch = now;
      void cryptoWorker.touch();
    }
  }

  function armIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void lock(), IDLE_MS);
  }

  const ACTIVITY = ['pointerdown', 'keydown', 'pointermove', 'wheel', 'touchstart'] as const;

  function startAutoLock() {
    if (typeof window === 'undefined' || listening) return;
    listening = true;
    for (const e of ACTIVITY) window.addEventListener(e, onActivity, { passive: true });
    armIdleTimer();
  }

  function stopAutoLock() {
    if (typeof window === 'undefined' || !listening) return;
    listening = false;
    for (const e of ACTIVITY) window.removeEventListener(e, onActivity);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  // --- lifecycle ------------------------------------------------------------

  /** Determine, on boot, whether a vault exists and try to resume a session. */
  async function init(): Promise<void> {
    const exists = await vaultRepo.isInitialized();
    const material = exists ? await vaultRepo.getMaterial() : null;

    if (exists && get(store).remember) {
      const { resumed } = await cryptoWorker.resume(IDLE_MS);
      if (resumed) {
        update((s) => ({ ...s, status: vaultTransition(s.status, { type: 'resumed' }), material }));
        startAutoLock();
        return;
      }
    }
    update((s) => ({
      ...s,
      status: vaultTransition(s.status, { type: 'checked', exists }),
      material
    }));
  }

  async function applyRemember(): Promise<void> {
    if (get(store).remember) await cryptoWorker.remember();
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
    if (!(await configRepo.get())) await configRepo.save(emptyConfig());
    await applyRemember();
    update((s) => ({
      ...s,
      status: vaultTransition(s.status, { type: 'setupDone' }),
      error: null,
      material
    }));
    startAutoLock();
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
    if (ok) await applyRemember();
    update((s) => ({
      ...s,
      status: vaultTransition(s.status, { type: ok ? 'unlockOk' : 'unlockFail' }),
      error: ok ? null : 'That passphrase did not match. Try again.',
      material
    }));
    if (ok) startAutoLock();
    return ok;
  }

  async function lock(): Promise<void> {
    stopAutoLock();
    await cryptoWorker.lock();
    // A lock always forgets the remembered session, so a reload re-prompts.
    await cryptoWorker.forget();
    update((s) => ({ ...s, status: vaultTransition(s.status, { type: 'lock' }), error: null }));
  }

  /** Toggle "keep me unlocked"; applies immediately if already unlocked. */
  async function setRemember(value: boolean): Promise<void> {
    try {
      localStorage.setItem(REMEMBER_KEY, value ? '1' : '0');
    } catch {
      /* storage disabled — preference is best-effort */
    }
    update((s) => ({ ...s, remember: value }));
    if (status() === 'unlocked') {
      if (value) await cryptoWorker.remember();
      else await cryptoWorker.forget();
    }
  }

  /** Forget everything on this device (irreversible). */
  async function reset(): Promise<void> {
    stopAutoLock();
    await cryptoWorker.forget();
    await vaultRepo.reset();
    cryptoWorker.terminate();
    update((s) => ({ ...s, status: vaultTransition(s.status, { type: 'reset' }), error: null, material: null }));
  }

  return { subscribe, init, setup, unlock, lock, reset, setRemember, status };
}

export const vault = createVaultStore();

// Re-export for convenience at call sites.
export type { AppConfig, ParsedConfig };
