/**
 * Transactions store: commit pipeline (import), decrypted cache (loadAll),
 * and on-demand rule application.
 */

import { writable, get } from 'svelte/store';
import { cryptoWorker } from '$lib/workers/cryptoClient';
import { transactionRepo, dateBucketOf } from '$lib/db/repos';
import { applyRules } from '$lib/rules/engine';
import type { AppConfig, Transaction } from '$lib/types';

export interface CommitResult {
  added: number;
  duplicates: number;
}

function createTransactionsStore() {
  const count = writable<number>(0);
  const all = writable<Transaction[]>([]);
  const loading = writable<boolean>(false);
  let loaded = false;

  async function refreshCount(): Promise<void> {
    count.set(await transactionRepo.count());
  }

  /** Decrypt all stored transactions and cache them. Idempotent. */
  async function loadAll(): Promise<Transaction[]> {
    if (loaded) return get(all);
    loading.set(true);
    try {
      const stored = await transactionRepo.allEncrypted();
      if (stored.length === 0) {
        all.set([]);
        count.set(0);
        loaded = true;
        return [];
      }
      const blobs = stored.map((s) => s.blob);
      const decrypted = await cryptoWorker.decryptMany<Transaction>(blobs);
      // Sort descending by date so the table default order is newest-first.
      decrypted.sort((a, b) => b.date.localeCompare(a.date));
      all.set(decrypted);
      count.set(decrypted.length);
      loaded = true;
      return decrypted;
    } finally {
      loading.set(false);
    }
  }

  /** Invalidate the cache (e.g. after lock). */
  function reset() {
    loaded = false;
    all.set([]);
    count.set(0);
  }

  /** Permanently delete every stored transaction (keeps vault + config). */
  async function clearAll(): Promise<void> {
    await transactionRepo.clear();
    reset();
    await refreshCount();
  }

  /**
   * Persist built transactions idempotently: existing fingerprints are skipped,
   * fresh ones are rule-applied, encrypted in the worker, and stored.
   */
  async function commit(txs: Transaction[], cfg?: AppConfig | null): Promise<CommitResult> {
    const withRules = cfg?.rules?.length ? applyRules(txs, cfg.rules) : txs;
    const fingerprints = withRules.map((t) => t.fingerprint);
    const existing = await transactionRepo.existingFingerprints(fingerprints);
    const fresh = withRules.filter((t) => !existing.has(t.fingerprint));

    let added = 0;
    if (fresh.length) {
      const blobs = await cryptoWorker.encryptMany(fresh);
      const rows = fresh.map((tx, i) => ({ tx, blob: blobs[i] }));
      const res = await transactionRepo.addEncrypted(rows);
      added = res.added;
    }

    // Invalidate cache so next loadAll() re-decrypts.
    loaded = false;
    await refreshCount();
    return { added, duplicates: txs.length - added };
  }

  /**
   * Re-apply rules to all stored transactions and persist the updated blobs.
   * Returns the number of transactions that changed.
   */
  async function applyAndSave(cfg: AppConfig): Promise<number> {
    // No rules ⇒ applyRules is a no-op, so nothing can change. Skip decrypting and
    // re-scanning the whole table.
    if (!cfg.rules?.length) return 0;
    loading.set(true);
    try {
      const stored = await transactionRepo.allEncrypted();
      if (stored.length === 0) return 0;

      const blobs = stored.map((s) => s.blob);
      const decrypted = await cryptoWorker.decryptMany<Transaction>(blobs);
      const updated = applyRules(decrypted, cfg.rules);

      // Find which ones changed.
      const changed: { stored: (typeof stored)[0]; tx: Transaction }[] = [];
      for (let i = 0; i < updated.length; i++) {
        const orig = decrypted[i];
        const next = updated[i];
        if (
          orig.categoryId !== next.categoryId ||
          orig.entity !== next.entity ||
          JSON.stringify(orig.tagIds) !== JSON.stringify(next.tagIds)
        ) {
          changed.push({ stored: stored[i], tx: next });
        }
      }

      if (changed.length) {
        const newBlobs = await cryptoWorker.encryptMany(changed.map((c) => c.tx));
        const rows = changed.map((c, i) => ({
          ...c.stored,
          blob: newBlobs[i]
        }));
        await transactionRepo.bulkUpdateBlobs(rows);
        loaded = false;
        await loadAll();
      }

      return changed.length;
    } finally {
      loading.set(false);
    }
  }

  /**
   * Set a single transaction's category, re-encrypting just that row and
   * updating the in-memory cache in place so the table reflects it instantly.
   * Date/amount/label are unchanged, so the fingerprint and dateBucket are too.
   */
  async function updateCategory(txId: string, categoryId: string | null): Promise<void> {
    const current = get(all).find((t) => t.id === txId);
    if (!current || current.categoryId === categoryId) return;
    const next: Transaction = { ...current, categoryId };
    const [blob] = await cryptoWorker.encryptMany([next]);
    await transactionRepo.bulkUpdateBlobs([
      { id: next.id, fingerprint: next.fingerprint, dateBucket: dateBucketOf(next.date), blob }
    ]);
    all.update((list) => list.map((t) => (t.id === txId ? next : t)));
  }

  return {
    subscribe: count.subscribe,
    all: { subscribe: all.subscribe },
    loading: { subscribe: loading.subscribe },
    refreshCount,
    loadAll,
    reset,
    clearAll,
    commit,
    applyAndSave,
    updateCategory
  };
}

export const transactions = createTransactionsStore();
