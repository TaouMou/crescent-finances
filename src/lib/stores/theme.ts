import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const KEY = 'crescent.theme';

function readInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function createThemeStore() {
  const { subscribe, set } = writable<Theme>(readInitial());

  let transitionTimer: ReturnType<typeof setTimeout> | undefined;

  function apply(theme: Theme) {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      // Glide the colour change instead of snapping: add a short-lived class
      // that turns on colour transitions everywhere, then strip it once the
      // cross-fade is done so it never affects normal interactions. Honour
      // reduced-motion by switching instantly.
      const reduce =
        typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) {
        root.classList.add('theme-transition');
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 360);
      }
      root.classList.toggle('dark', theme === 'dark');
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
