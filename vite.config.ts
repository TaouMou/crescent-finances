import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Root for local dev/preview; subpath (e.g. "/crescent-finances/") for GitHub Pages.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    // Build/iteration phase: ship a self-destroying service worker. It replaces
    // any previously-installed cache-first SW, unregisters itself, and clears the
    // old caches, so the deployed site always serves the latest build from the
    // network (no more stale shell while we iterate). A full offline PWA
    // (manifest + precache) will be restored once the app stabilises near release.
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate'
    })
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        // Split the larger libraries into their own cacheable chunks so they
        // don't bloat the entry bundle. Route views are already code-split via
        // dynamic import() in App.svelte; uPlot/papaparse are lazy-loaded at the
        // call site, so they get their own chunks automatically.
        manualChunks: {
          dexie: ['dexie'],
          zod: ['zod']
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    globals: true
  }
});
