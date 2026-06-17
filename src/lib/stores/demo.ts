/**
 * Demo-data toggle. A device-local UI preference (not part of the shareable
 * config): when ON, dashboard/monthly panels fall back to illustrative seed
 * data while there are no real transactions, so a fresh vault shows how the
 * app works end-to-end. When OFF, panels show only real data (empty states
 * when there's nothing imported) — no mixing of seed and real numbers.
 *
 * Persisted in localStorage, mirroring the theme store. Defaults to ON.
 */

import { writable, get } from 'svelte/store';

const KEY = 'crescent.demoMode';

function readInitial(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function createDemoStore() {
  const store = writable<boolean>(readInitial());

  function apply(on: boolean) {
    try {
      localStorage.setItem(KEY, String(on));
    } catch {
      /* private mode / storage disabled — non-fatal */
    }
    store.set(on);
  }

  return {
    subscribe: store.subscribe,
    set: apply,
    toggle: () => apply(!get(store))
  };
}

export const demoMode = createDemoStore();
