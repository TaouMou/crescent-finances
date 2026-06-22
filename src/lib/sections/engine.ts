/**
 * Pure section-evaluation engine. Turns the user's configured section groups +
 * sections (src/lib/types.ts) into the view-ready shapes the dashboard section
 * components already consume (DistributionGroup / TargetSection from the seed
 * module). No Svelte/DOM globals, so vitest can cover it directly — mirrors the
 * style of src/lib/aggregations.ts and src/lib/rules/engine.ts.
 *
 * Money is integer minor units (cents), signed: negative = expense.
 *
 * SLICE NOTE: `filterSum` sections derive a real *actual* from matching
 * transactions (see src/lib/sections/filter.ts). `percentage`/`fixed`/`remainder`
 * are income-allocation intents with no transaction linkage, so their `actual`
 * mirrors `planned` ("on plan"). `accountBalance` sections and goal `current`
 * read a linked asset pool's net balance (sum of its accounts' transactions).
 */

import type { AssetPool, Section, SectionCalc, SectionGroup, Transaction } from '$lib/types';
import type { DistributionGroup, DistributionSection, SectionKind, TargetSection } from '$lib/seed/dashboard';
import { summarize } from '$lib/aggregations';
import { filterSum } from './filter';

type TargetCalc = Extract<SectionCalc, { type: 'target' }>;

/** Signed balance per (non-null) account, scoped to txs dated on/before `to`. */
type AccountBalances = Map<string, number>;

/**
 * Net balance of every account in a single pass, so a plan with many
 * pool-backed sections/goals doesn't re-scan the full transaction list once per
 * section. Pass `to` to sum only transactions on or before that ISO date
 * (cumulative-as-of); omit for the all-time balance.
 */
function accountBalanceIndex(txs: Transaction[], to?: string): AccountBalances {
  const balances: AccountBalances = new Map();
  for (const tx of txs) {
    if (tx.accountId === null) continue;
    if (to && tx.date > to) continue;
    balances.set(tx.accountId, (balances.get(tx.accountId) ?? 0) + tx.amount);
  }
  return balances;
}

/** Net balance of the named asset pool from a precomputed index; 0 if unknown. */
function poolBalance(
  pools: AssetPool[],
  assetPoolId: string | undefined,
  balances: AccountBalances
): number {
  if (!assetPoolId) return 0;
  const pool = pools.find((p) => p.id === assetPoolId);
  if (!pool) return 0;
  let sum = 0;
  for (const id of pool.accountIds) sum += balances.get(id) ?? 0;
  return sum;
}

/** Sections belonging to a group (by back-reference or group membership list), ordered. */
export function sectionsOfGroup(group: SectionGroup, sections: Section[]): Section[] {
  const seen = new Set<string>();
  return sections
    .filter((s) => s.groupId === group.id || group.sectionIds.includes(s.id))
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => a.order - b.order);
}

/**
 * Evaluate a group into a planned-vs-actual distribution view. The group source
 * is the period income; each member section's planned amount comes from its calc
 * (`percentage` of income, `fixed`, `remainder`, a `filterSum` planned hint, or
 * an `accountBalance` pool balance). `target` sections render separately.
 *
 * Pass `from`/`to` (ISO YYYY-MM-DD) to scope income and filterSum actuals to a
 * specific period (e.g. a single calendar month). Omit for all-time evaluation.
 */
export function evaluateDistribution(
  group: SectionGroup,
  sections: Section[],
  txs: Transaction[],
  pools: AssetPool[] = [],
  from?: string,
  to?: string,
  balances: AccountBalances = accountBalanceIndex(txs, to)
): DistributionGroup {
  const total = summarize(txs, from, to).income;
  const members = sectionsOfGroup(group, sections).filter((s) => s.calc.type !== 'target');

  // First pass: planned for everything except remainder.
  const planned = new Map<string, number>();
  for (const s of members) {
    const c = s.calc;
    if (c.type === 'percentage') planned.set(s.id, Math.round((c.percent / 100) * total));
    else if (c.type === 'fixed') planned.set(s.id, c.amount);
    else if (c.type === 'filterSum') planned.set(s.id, c.planned ?? 0);
    else if (c.type === 'accountBalance') planned.set(s.id, Math.abs(poolBalance(pools, c.assetPoolId, balances)));
  }
  // Second pass: remainder absorbs whatever income is left after the rest.
  const allocated = [...planned.values()].reduce((a, b) => a + b, 0);
  for (const s of members) {
    if (s.calc.type === 'remainder') planned.set(s.id, Math.max(0, total - allocated));
  }

  const distSections: DistributionSection[] = members.map((s) => {
    const p = planned.get(s.id) ?? 0;
    const kind = s.calc.type as SectionKind;
    const plannedPct =
      s.calc.type === 'percentage'
        ? s.calc.percent
        : s.calc.type === 'remainder'
          ? undefined
          : total > 0
            ? Math.round((p / total) * 100)
            : undefined;
    // filterSum sections draw a real actual from matching transactions scoped to
    // the selected period; the others carry actual == planned.
    const actual =
      s.calc.type === 'filterSum'
        ? Math.abs(
            filterSum(txs, {
              ...s.calc.filter,
              ...(from !== undefined ? { fromDate: from } : {}),
              ...(to !== undefined ? { toDate: to } : {})
            })
          )
        : p;
    // Tracked spending is the only type with a real actual ≠ planned, and it is a
    // spending bucket: over plan = bad. The allocation intents always sit on plan
    // (actual == planned), so their direction never colours a delta.
    const direction = s.calc.type === 'filterSum' ? ('lowerIsBetter' as const) : undefined;
    return { id: s.id, name: s.name, color: s.color, kind, plannedPct, planned: p, actual, direction };
  });

  return { id: group.id, name: group.name, source: 'Income', total, sections: distSections };
}

/**
 * Extract `target` sections as goal-progress items, ordered. `current` reads the
 * linked asset pool's balance when `assetPoolId` is set, else 0.
 *
 * Pass `to` (ISO YYYY-MM-DD) to compute the pool balance as of that date
 * (cumulative savings up to month-end). Omit for the all-time balance.
 */
export function evaluateTargets(
  sections: Section[],
  txs: Transaction[] = [],
  pools: AssetPool[] = [],
  to?: string,
  balances: AccountBalances = accountBalanceIndex(txs, to)
): TargetSection[] {
  return sections
    .filter((s) => s.calc.type === 'target')
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const c = s.calc as TargetCalc;
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        current: Math.max(0, poolBalance(pools, c.assetPoolId, balances)),
        target: c.targetAmount,
        targetDate: c.targetDate,
        startDate: c.startDate
      };
    });
}

const MONTH_MS = (365.25 / 12) * 24 * 60 * 60 * 1000;
/** Fallback pace window when a goal has a target date but no explicit start. */
const DEFAULT_PACE_WINDOW_MS = 12 * MONTH_MS;
/** Tolerance (in fraction-of-goal) before a goal reads as ahead/behind vs on track. */
const PACE_EPS = 0.02;

export interface TargetPace {
  /** Progress so far, current/target, clamped to 0..1. */
  progressFraction: number;
  /** Where you'd be by now to land exactly on the target date, 0..1; null without a target date. */
  expectedFraction: number | null;
  /** Schedule standing. `none` = no target date to pace against. */
  status: 'ahead' | 'behind' | 'onTrack' | 'done' | 'none';
  /** Remaining amount to reach the target (minor units, ≥ 0). */
  toGo: number;
  /** Whole months left until the target date (≥ 0); null without a target date. */
  monthsRemaining: number | null;
  /** Amount to set aside each remaining month to hit the target on time; null without a target date. */
  perMonthNeeded: number | null;
}

/**
 * Pure pace evaluation for a goal: how far along you are versus where a steady
 * contribution from `startDate` (or a default 12-month window) to `targetDate`
 * would put you today, plus the monthly amount still needed. `now` is injected
 * for testability. Money is integer minor units.
 */
export function targetPace(
  t: { current: number; target: number; startDate?: string; targetDate?: string },
  now: number = Date.now()
): TargetPace {
  const target = Math.max(0, t.target);
  const progressFraction = target > 0 ? Math.min(1, Math.max(0, t.current / target)) : 0;
  const toGo = Math.max(0, target - t.current);
  const done = target > 0 && t.current >= target;

  if (!t.targetDate) {
    return {
      progressFraction,
      expectedFraction: null,
      status: done ? 'done' : 'none',
      toGo,
      monthsRemaining: null,
      perMonthNeeded: null
    };
  }

  const end = new Date(`${t.targetDate}T00:00:00`).getTime();
  const start = t.startDate
    ? new Date(`${t.startDate}T00:00:00`).getTime()
    : end - DEFAULT_PACE_WINDOW_MS;
  const span = end - start;
  const expectedFraction =
    span > 0 ? Math.min(1, Math.max(0, (now - start) / span)) : now >= end ? 1 : 0;

  const monthsRemaining = Math.max(0, Math.ceil((end - now) / MONTH_MS));
  // Spread the shortfall over whole months left; once the deadline is here it is all due now.
  const perMonthNeeded = done ? 0 : Math.round(toGo / Math.max(1, monthsRemaining));

  let status: TargetPace['status'];
  if (done) status = 'done';
  else if (progressFraction >= expectedFraction + PACE_EPS) status = 'ahead';
  else if (progressFraction <= expectedFraction - PACE_EPS) status = 'behind';
  else status = 'onTrack';

  return { progressFraction, expectedFraction, status, toGo, monthsRemaining, perMonthNeeded };
}

export interface EvaluatedGroup {
  group: SectionGroup;
  /** Planned-vs-actual distribution for the group's allocation sections. */
  distribution: DistributionGroup;
  /** Goal-progress items for the group's `target` sections. */
  targets: TargetSection[];
}

/**
 * Evaluate every group in config order, pairing distribution + targets per group.
 * Pass `from`/`to` to scope income, filterSum actuals, and goal balances to a period.
 */
export function evaluatePlan(
  groups: SectionGroup[],
  sections: Section[],
  txs: Transaction[],
  pools: AssetPool[] = [],
  from?: string,
  to?: string
): EvaluatedGroup[] {
  // Build the account-balance index once and share it across every group, instead
  // of re-scanning the transaction list inside each section/goal evaluation.
  const balances = accountBalanceIndex(txs, to);
  return [...groups]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      group,
      distribution: evaluateDistribution(group, sections, txs, pools, from, to, balances),
      targets: evaluateTargets(sectionsOfGroup(group, sections), txs, pools, to, balances)
    }));
}
