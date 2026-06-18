/**
 * Sync store: orchestrates the download → merge → upload cycle with Google
 * Drive. The merge is fingerprint-based — no decryption needed for already-local
 * transactions. Only new-from-remote blobs are decrypted (to recover id/date
 * for the IndexedDB row) before being added to the local DB.
 *
 * Config is not synced: local config always wins. Transactions are append-only
 * and deduped by fingerprint, so merging is conflict-free.
 */

import { writable, get } from 'svelte/store';
import { vaultRepo, transactionRepo, configRepo } from '$lib/db/repos';
import { buildBackup, serializeBackup, parseBackup } from '$lib/config/backup';
import { transactions } from '$lib/stores/transactions';
import { cryptoWorker } from '$lib/workers/cryptoClient';
import * as gdrive from '$lib/sync/gdrive';
import type { Transaction } from '$lib/types';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
  connected: boolean;
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
}

const KEY_LAST_SYNCED = 'crescent.sync.lastSyncedAt';

function readLastSynced(): string | null {
  try { return localStorage.getItem(KEY_LAST_SYNCED); } catch { return null; }
}

function writeLastSynced(at: string): void {
  try { localStorage.setItem(KEY_LAST_SYNCED, at); } catch {}
}

function createSyncStore() {
  const store = writable<SyncState>({
    connected: gdrive.isConnected(),
    status: 'idle',
    error: null,
    lastSyncedAt: readLastSynced()
  });
  const { subscribe, update } = store;

  async function doSync(token: string): Promise<void> {
    const material = await vaultRepo.getMaterial();
    if (!material) throw new Error('No vault found.');
    const localConfig = await configRepo.get();
    if (!localConfig) throw new Error('No config found.');
    const localStored = await transactionRepo.allEncrypted();

    const localBackup = buildBackup({
      config: localConfig,
      kdf: { saltB64: material.saltB64, iterations: material.iterations },
      verifier: material.verifier,
      transactions: localStored.map((s) => ({
        fingerprint: s.fingerprint,
        iv: s.blob.iv,
        ct: s.blob.ct
      }))
    });

    const remoteJson = await gdrive.downloadBackup(token);

    if (!remoteJson) {
      // First sync — nothing on Drive yet. Upload local state.
      await gdrive.uploadBackup(token, serializeBackup(localBackup));
      return;
    }

    let remoteBackup;
    try {
      remoteBackup = parseBackup(remoteJson);
    } catch {
      throw new Error(
        'Remote backup could not be read. It may have been created by an older version — ' +
          'export a fresh backup from your other device and re-sync.'
      );
    }

    if (remoteBackup.kdf.saltB64 !== material.saltB64) {
      throw new Error(
        'Remote backup belongs to a different vault. Use "Restore backup" if you want to switch.'
      );
    }

    // Fingerprint diff: find transactions on remote that are not local.
    const localFps = new Set(localStored.map((s) => s.fingerprint));
    const incoming = remoteBackup.transactions.filter((tx) => !localFps.has(tx.fingerprint));

    if (incoming.length > 0) {
      // Decrypt only the incoming blobs (same key — same vault) to recover id/date.
      const decrypted = await cryptoWorker.decryptMany<Transaction>(
        incoming.map((tx) => ({ iv: tx.iv, ct: tx.ct }))
      );
      await transactionRepo.addEncrypted(
        decrypted.map((tx, i) => ({
          tx: { id: tx.id, fingerprint: incoming[i].fingerprint, date: tx.date },
          blob: { iv: incoming[i].iv, ct: incoming[i].ct }
        }))
      );
      // Invalidate the decrypted cache so next loadAll() picks up the new rows.
      transactions.reset();
      await transactions.refreshCount();
    }

    // Upload the merged backup (union of both sides, local config).
    const mergedStored = await transactionRepo.allEncrypted();
    const mergedBackup = buildBackup({
      config: localConfig,
      kdf: { saltB64: material.saltB64, iterations: material.iterations },
      verifier: material.verifier,
      transactions: mergedStored.map((s) => ({
        fingerprint: s.fingerprint,
        iv: s.blob.iv,
        ct: s.blob.ct
      }))
    });
    await gdrive.uploadBackup(token, serializeBackup(mergedBackup));
  }

  /** Connect to Google Drive and perform the first sync. */
  async function connect(clientId: string): Promise<void> {
    update((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      const token = await gdrive.connect(clientId);
      update((s) => ({ ...s, connected: true }));
      await doSync(token);
      const now = new Date().toISOString();
      writeLastSynced(now);
      update((s) => ({ ...s, status: 'idle', lastSyncedAt: now }));
    } catch (err) {
      update((s) => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to connect.'
      }));
    }
  }

  /** Sync with Drive (download → merge → upload). No-op if already syncing. */
  async function sync(): Promise<void> {
    if (get(store).status === 'syncing') return;
    const clientId = gdrive.loadClientId();
    if (!clientId) return;
    update((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      const token = await gdrive.getToken(clientId);
      await doSync(token);
      const now = new Date().toISOString();
      writeLastSynced(now);
      update((s) => ({ ...s, status: 'idle', lastSyncedAt: now }));
    } catch (err) {
      update((s) => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Sync failed.'
      }));
    }
  }

  /** Disconnect from Drive and clear all local Drive state. */
  function disconnect(): void {
    gdrive.disconnect();
    try { localStorage.removeItem(KEY_LAST_SYNCED); } catch {}
    update(() => ({ connected: false, status: 'idle', error: null, lastSyncedAt: null }));
  }

  return { subscribe, connect, sync, disconnect };
}

export const syncStore = createSyncStore();
