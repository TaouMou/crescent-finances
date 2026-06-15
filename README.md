# Crescent Finances

A local-first, private personal-finance tracker, built as an offline PWA. It ingests
CSV exports from your bank, stores them in an encrypted local database, and never sends
data anywhere. See balances, charts, and filterable transactions; auto-group
transactions; plan your money with sections you define entirely yourself (shareable as
a config file); and get warned when a spending category is abnormally high.

> Privacy by design: no cloud, no live bank sync (CSV import only), no telemetry. All
> financial data is encrypted at rest behind a passphrase. The app ships with **zero
> predefined sections** — you create all of them.

## Stack

- **Svelte 5 + TypeScript + Vite**, shipped as an offline PWA (`vite-plugin-pwa`).
- **Storage:** Dexie.js over IndexedDB; financial rows encrypted at rest.
- **Encryption:** Web Crypto (AES-GCM 256; key from PBKDF2 ≥210k iterations) — in a Web Worker.
- **CSV parsing:** PapaParse, lazy-loaded and run inside a Web Worker.
- **Charts:** uPlot (lazy-loaded on the dashboard) + hand-rolled SVG for sparklines.
- **UI:** Tailwind + Bits UI primitives, Inter (self-hosted), Phosphor icons.

## Design — Tide palette

| Token    | Light     | Dark      |
| -------- | --------- | --------- |
| Paper    | `#F6F7F5` | `#131618` |
| Surface  | `#FFFFFF` | `#1B1F22` |
| Ink      | `#1A1D21` | `#E8EAE9` |
| Muted    | `#6E7A82` | `#8A949B` |
| Hairline | `#E3E7E5` | `#2A2F33` |
| Accent   | `#14776B` | `#3DA192` |

Semantic (both): income `#2E7D5B`, expense `#B4443C`, warn `#B5862B`.

## Scripts

```bash
npm run dev      # dev server
npm run build    # typecheck + production build
npm run check    # svelte-check
npm run test     # vitest
```

## Status

Built in milestones (see the build plan). **M0** — scaffold, design tokens, and the
dashboard shell rendered on seed data — is complete. Next: storage + encryption, CSV
import in a worker, the views, then the section engine and anomaly logic.
