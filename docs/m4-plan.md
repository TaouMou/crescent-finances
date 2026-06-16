# M4 — Planning & Goals

Reconstructed plan (the original was lost). Recovered by auditing the scaffolding
already present in the codebase: a fully-defined config data model that the UI never
exercised, plus demo-only dashboard cards.

## Why this milestone exists

`src/lib/config/schema.ts` and `src/lib/types.ts` already define `sectionGroups`,
`sections` (six calc types: `percentage`, `fixed`, `remainder`, `filterSum`,
`accountBalance`, `target`), `schedule`, `assetPools`, and `settings.anomaly` — but
nothing created, persisted, or evaluated them. The dashboard's **Distribution**,
**Goals**, and **Anomalies** cards rendered hard-coded demo data from
`src/lib/seed/dashboard.ts`; the sidebar's "Goals" entry pointed at a dead `#g2`
route and "+ New group" had no handler; `#settings` had no view. M4 turns that latent
model into a working feature.

## Data model → UI mapping

| Config (`types.ts`) | Evaluated by | Rendered by |
|---------------------|--------------|-------------|
| `SectionGroup` + `Section` (`percentage`/`fixed`/`remainder`) | `evaluateDistribution` | `DistributionView` |
| `Section` (`target`) | `evaluateTargets` | `TargetProgress` |
| `settings.anomaly` | — (detection deferred) | `AnomaliesList` (still demo) |

## Slice 1 — shipped

Foundational, persisted Plan + minimal Settings.

- **`src/lib/sections/engine.ts`** — pure evaluator. `evaluateDistribution`,
  `evaluateTargets`, `evaluatePlan`, `sectionsOfGroup`. Group source = period income
  (`summarize` from `aggregations.ts`); planned amounts from each section's calc;
  `remainder` absorbs the leftover. Unit-tested in `tests/sections/engine.test.ts`.
- **`src/lib/components/plan/PlanView.svelte`** — `#plan` route. Renders each group's
  distribution + goals; inline CRUD for groups and sections (calc types
  `percentage`/`fixed`/`remainder`/`target`), persisted via
  `config.save({ ...$config, sectionGroups, sections })` and validated with
  `safeParseConfig`.
- **`src/lib/components/settings/SettingsView.svelte`** — `#settings` route.
  Currency/locale/name, anomaly thresholds (stored only), and config-template
  export/import via `serializeConfigTemplate` / `parseConfigTemplate`.
- **Sidebar** renders section groups from live config and wires "+ New group" (via
  `src/lib/stores/plan-ui.ts`). **Dashboard** uses real distribution/targets when
  sections exist, falling back to seed demo otherwise.

### Known limitation (by design)

Without transaction-linked calcs, distribution `actual` mirrors `planned` ("on plan")
and target `current` is 0. Real actuals/current arrive with `filterSum` /
`accountBalance` (Slice 2).

## Deferred — later M4 slices

- **Anomaly detection engine** — read `settings.anomaly`, compute a baseline
  (`baselineMonths`), flag categories over `thresholdPct` / `minAbsolute` / MAD `madK`,
  feed `AnomaliesList` real data.
- **Asset pools** UI + `accountBalance` calc (and target `current` from a pool).
- **`filterSum`** calc editor → real per-section `actual` from matching transactions.
- **Section `schedule`** UI/execution (interval / anniversary).
- **Full encrypted backup** export/import (needs the crypto worker, unlike the
  plaintext template already wired in Settings).

## Verify

```sh
npm run check && npm test && npm run build
```

Manual (set up a vault, then): `#plan` → New group → add `percentage` + `remainder`
sections → renders in the group card and the sidebar; add a `target` section → Goals
bar; `#settings` → change currency, export/import a template; Dashboard reflects the
real plan once sections exist. Verify light + dark.
