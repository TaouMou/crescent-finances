# Crescent Finances — Claude Context

## What it is

Local-first personal finance app. All data is encrypted at rest in the browser's IndexedDB.
No backend, no accounts, no cloud sync — everything lives in the browser.
CSV import from bank exports is the only data ingestion path.
Built with SvelteKit/Svelte 5, TypeScript, Dexie/IndexedDB, Tailwind, Vite.

## Security model

- **KDF:** PBKDF2-SHA256, ≥210 000 iterations, random 16-byte salt per vault.
- **Cipher:** AES-GCM-256, random 12-byte IV per encrypted object.
- **Verifier:** A token encrypted with the derived key; successful decryption proves the passphrase is correct without storing it.
- **Key isolation:** The derived `CryptoKey` is **non-extractable** and lives **only inside the crypto Web Worker** (`src/lib/workers/`). It is never transferred or posted to the main thread.
- **No recovery:** The passphrase is never stored. There is no recovery path if the passphrase is forgotten.

## "Keep me unlocked on this device"

Opt-in. The non-extractable `CryptoKey` is persisted (via IndexedDB structured-clone) inside the worker's own session store (`session-store.ts`). On next boot the worker tries to resume the saved key if it is within the idle window.

- **Idle auto-lock:** 15 minutes of inactivity. Any lock (sidebar Lock button or idle timeout) forgets the session so the next page load re-prompts for the passphrase.

## Architecture — key files

### `src/lib/workers/`
| File | Purpose |
|------|---------|
| `crypto-import.worker.ts` | Worker entry point (routes messages) |
| `crypto-core.ts` | Pure crypto protocol handler (testable, no browser globals) |
| `cryptoClient.ts` | Main-thread client wrapping postMessage in promises |
| `protocol.ts` | Typed request/response shapes (`WorkerRequest`, `WorkerResponse`, `ResultMap`) |
| `session-store.ts` | Session key persistence inside the worker (its own IDB) |
| `import-core.ts` | CSV parsing + transaction building inside the worker |

### `src/lib/db/`
| File | Purpose |
|------|---------|
| `db.ts` | Dexie schema — tables: `meta`, `transactions`, `config` |
| `repos.ts` | `VaultRepo`, `TransactionRepo`, `ConfigRepo` |

Transactions are stored encrypted: only `id`, `fingerprint`, `dateBucket` are plaintext; the full row lives in an AES-GCM blob.

### `src/lib/stores/`
| File | Purpose |
|------|---------|
| `vault.ts` | Lock/unlock/setup/reset state + idle timer; never holds the key |
| `vault-machine.ts` | Pure `(state, event) → state` — unit-tested |
| `transactions.ts` | Import-commit pipeline + decrypted transaction cache (`loadAll`, `applyAndSave`) |
| `config.ts` | Config load/save |
| `theme.ts` | Light/dark toggle |

### `src/lib/config/`
| File | Purpose |
|------|---------|
| `schema.ts` | Zod schemas for `AppConfig` and sub-types |
| `backup.ts` | Encrypted backup serialization |

### `src/lib/rules/`
| File | Purpose |
|------|---------|
| `engine.ts` | Pure rule-matching and application — `applyRules(txs, rules)` |

Rules match on `label` or `entity` fields by keyword or regex, sorted by priority (lower = first). Actions: `setCategoryId`, `setEntity`, `addTagIds`. Applied on CSV import (in `transactions.commit`) and on demand via `transactions.applyAndSave`.

### `src/lib/aggregations.ts`
Pure functions over decrypted `Transaction[]`:
- `summarize(txs, from?, to?)` → `{ income, spending, net }`
- `categoryBreakdown(txs, categories, from?, to?)` → spending by category
- `monthlyNets(txs)` → `{ bucket, income, spending, net, cumulative }[]`

### `src/lib/seed/dashboard.ts`
Demo data used when no real transactions are loaded (bypass mode or empty vault):
`summary`, `spendingByCategory`, `netSeries`, `distribution`, `targets`, `demoMonthly`.

### `src/lib/components/`
| Path | Purpose |
|------|---------|
| `auth/LockScreen.svelte` | Setup passphrase + unlock UI |
| `layout/Sidebar.svelte` | Navigation + collapse; Plan section expands to sub-routes |
| `layout/Topbar.svelte` | Header |
| `dashboard/Dashboard.svelte` | Main view with real aggregations (falls back to demo seed data) |
| `dashboard/SummaryCards.svelte` | Income/spending/net/balance with count-up animation |
| `transactions/TransactionsView.svelte` | Virtualized, sortable, filterable table (mobile: 2-col; desktop: 4-col) |
| `rules/RulesView.svelte` | Rule CRUD UI with enable/disable toggle and "Apply now" |
| `monthly/MonthlyView.svelte` | Monthly breakdown — income/spending/net per month with mini bar chart |
| `import/ImportView.svelte` | Multi-step CSV import |
| `ui/CountUp.svelte` | Animated number count-up (rAF + ease-out cubic) |

## Design tokens (`src/styles/tokens.css`)

Light mode uses a **warm cream palette** — no pure white:
- `--c-paper`: `#EBE6DC` (page background)
- `--c-surface`: `#FAF6EE` (cards, inputs)
- `--c-accent`: `#0DA882` (vivid teal)
- `--c-income`: `#1A9E6F` · `--c-expense`: `#D0382D` · `--c-warn`: `#D49820`

Dark mode keeps the current cool-neutral palette (`#131618` paper, `#1B1F22` surface).

Bokeh radial gradients are **disabled in light mode** (`--bokeh-a1: 0; --bokeh-a2: 0`) to prevent random grey blobs on cream cards.

## Conventions

- Money is always **integer minor units** (cents), signed: negative = expense.
- Never send the crypto key to the main thread — all encrypt/decrypt goes through the worker.
- Pure logic (state machines, rule engine, aggregations, parsers) lives in plain `.ts` files, no Svelte globals, so vitest can test them without DOM or worker setup.
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) throughout; no Svelte 4 options API.
- Config is financial-data-free (no balances, no transactions) and is stored in plaintext — shareable as a template.
- Hash-based routing: `#dashboard`, `#transactions`, `#monthly`, `#import`, `#rules`, `#settings`. Falls back to `#dashboard`.

## Dev / verify workflow

```sh
npm run check     # svelte-check (TypeScript)
npm test          # vitest run
npm run build     # type-check + vite build
```

Browser e2e screenshots via `scripts/shot.mjs` (Playwright, bundled Chromium at `/opt/pw-browsers/`).

### Dev vault bypass

Set `VITE_DEV_BYPASS=true` in `.env.local` to skip the passphrase screen and render the app with demo seed data. Never committed; has no effect in production builds.

```sh
echo "VITE_DEV_BYPASS=true" > .env.local
npm run build && npx vite preview
```

## Git workflow

- **`main`** — production. Only receives squash-merges from `dev` at milestone boundaries.
- **`dev`** — integration branch. Always stable; feature branches cut from here.
- **`feature/xxx`** — branch off `dev`, PR back to `dev` when done.
- Deploy (GitHub Pages) triggered manually via `workflow_dispatch` on `deploy-pages.yml`.

## Status

- **M1** — Encrypted vault foundation: crypto worker, PBKDF2/AES-GCM, Dexie schema, LockScreen, config schema, backup format. ✅
- **M2** — CSV import: import worker, fingerprinting/dedup, ImportView (3-step UI), import profiles, idle auto-lock. ✅
- **M3** — Virtualized transactions table, rule engine, real dashboard aggregations, count-up animations, View Transitions, hash router, monthly breakdown view, warm cream palette. ✅
- **M4** — TBD
