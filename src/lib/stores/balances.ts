/**
 * Starting-balances store: the user's real per-account balance anchors. These
 * are financial data, so they are persisted ENCRYPTED (via the crypto worker)
 * as a single blob in `meta`. The dashboard combines them with transactions to
 * show the true Liquid balance.
 *
 * Like the transactions store, this never holds the key — encrypt/decrypt go
 * through the worker, and the in-memory map is cleared on lock.
 */

import { writable, get } from 'svelte/store';
import { cryptoWorker } from '$lib/workers/cryptoClient';
import { balanceRepo } from '$lib/db/repos';
import type { StartingBalances } from '$lib/types';

function createBalancesStore() {
  const map = writable<StartingBalances>({});
  let loaded = false;

  /** Decrypt and cache the saved balances. Idempotent. */
  async function load(): Promise<StartingBalances> {
    if (loaded) return get(map);
    const blob = await balanceRepo.getBlob();
    const value = blob ? await cryptoWorker.decrypt<StartingBalances>(blob) : {};
    map.set(value);
    loaded = true;
    return value;
  }

  /** Encrypt and persist the given balances, updating the cache in place. */
  async function save(next: StartingBalances): Promise<void> {
    const blob = await cryptoWorker.encrypt(next);
    await balanceRepo.saveBlob(blob);
    map.set(next);
    loaded = true;
  }

  /** Invalidate the cache (e.g. on lock). */
  function reset(): void {
    loaded = false;
    map.set({});
  }

  return { subscribe: map.subscribe, load, save, reset };
}

export const balances = createBalancesStore();
