/**
 * Transactions store: tracks how many rows are stored and owns the import-commit
 * path (dedup against existing fingerprints, encrypt the new ones in the worker,
 * persist). Decryption/listing for the table arrives in M3.
 */

import { writable } from 'svelte/store';
import { cryptoWorker } from '$lib/workers/cryptoClient';
import { transactionRepo } from '$lib/db/repos';
import type { Transaction } from '$lib/types';

export interface CommitResult {
  added: number;
  duplicates: number;
}

function createTransactionsStore() {
  const count = writable<number>(0);

  async function refreshCount(): Promise<void> {
    count.set(await transactionRepo.count());
  }

  /**
   * Persist built transactions idempotently: existing fingerprints are skipped,
   * the remainder are encrypted in the worker and stored. Returns how many were
   * added vs recognized as duplicates.
   */
  async function commit(txs: Transaction[]): Promise<CommitResult> {
    const fingerprints = txs.map((t) => t.fingerprint);
    const existing = await transactionRepo.existingFingerprints(fingerprints);
    const fresh = txs.filter((t) => !existing.has(t.fingerprint));

    let added = 0;
    if (fresh.length) {
      const blobs = await cryptoWorker.encryptMany(fresh);
      const rows = fresh.map((tx, i) => ({ tx, blob: blobs[i] }));
      const res = await transactionRepo.addEncrypted(rows);
      added = res.added;
    }
    await refreshCount();
    return { added, duplicates: txs.length - added };
  }

  return { subscribe: count.subscribe, refreshCount, commit };
}

export const transactions = createTransactionsStore();
