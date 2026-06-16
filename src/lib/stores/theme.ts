import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const KEY = 'crescent.theme';

function readInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function createThemeStore() {
  const { subscribe, set } = writable<Theme>(readInitial());

  function apply(theme: Theme) {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        /* private mode / storage disabled — non-fatal */
      }
    }
    set(theme);
  }

  return {
    subscribe,
    set: apply,
    toggle: () => apply(readInitial() === 'dark' ? 'light' : 'dark')
  };
}

export const theme = createThemeStore();
