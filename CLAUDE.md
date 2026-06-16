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
| `transactions.ts` | Import-commit pipeline + decrypted transaction cache (loadAll) |
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
- `summarize(txs, from?, to?)` → `{income, spending, net}`
- `categoryBreakdown(txs, categories, from?, to?)` → spending by category
- `monthlyNets(txs)` → monthly income/spending/net series

### `src/lib/components/`
| Path | Purpose |
|------|---------|
| `auth/LockScreen.svelte` | Setup passphrase + unlock UI |
| `layout/Sidebar.svelte` | Navigation + collapse |
| `layout/Topbar.svelte` | Header |
| `dashboard/Dashboard.svelte` | Main view with real aggregations (falls back to empty state) |
| `dashboard/SummaryCards.svelte` | Income/spending/net/balance with count-up animation |
| `transactions/TransactionsView.svelte` | Virtualized, sortable, filterable table |
| `rules/RulesView.svelte` | Rule CRUD UI |
| `import/ImportView.svelte` | Multi-step CSV import |
| `ui/CountUp.svelte` | Animated number count-up component |

## Conventions

- Money is always **integer minor units** (cents), signed: negative = expense.
- Never send the crypto key to the main thread — all encrypt/decrypt goes through the worker.
- Pure logic (state machines, rule engine, aggregations, parsers) lives in plain `.ts` files, no Svelte globals, so vitest can test them without DOM or worker setup.
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) throughout; no Svelte 4 options API.
- Config is financial-data-free (no balances, no transactions) and is stored in plaintext — shareable as a template.
- Hash-based routing: `#dashboard`, `#transactions`, `#import`, `#rules`, `#settings`. Falls back to `#dashboard`.

## Dev / verify workflow

```sh
npm run check     # svelte-check (TypeScript)
npm test          # vitest run
npm run build     # type-check + vite build
```

Browser e2e screenshots via `scripts/shot.mjs` (Playwright, bundled Chromium at `/opt/pw-browsers/`).

## Status

- **M1** — Encrypted vault foundation: crypto worker, PBKDF2/AES-GCM, Dexie schema, LockScreen, config schema, backup format. ✅
- **M2** — CSV import: import worker, fingerprinting/dedup, ImportView (3-step UI), import profiles, idle auto-lock. ✅
- **M3** — Virtualized transactions table, rule engine, real dashboard aggregations, count-up animations, View Transitions, hash router. ✅
