import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      // App shell only — no financial data is ever cached or served.
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        navigateFallback: '/index.html'
      },
      manifest: {
        name: 'Crescent Finances',
        short_name: 'Crescent',
        description: 'Local-first, private personal-finance tracker.',
        theme_color: '#14776b',
        background_color: '#f6f7f5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    globals: true
  }
});
