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
import { accountsBalance, summarize } from '$lib/aggregations';
import { filterSum } from './filter';

type TargetCalc = Extract<SectionCalc, { type: 'target' }>;

/** Net balance of the named asset pool (sum of its accounts' transactions); 0 if unknown. */
function poolBalance(pools: AssetPool[], assetPoolId: string | undefined, txs: Transaction[]): number {
  if (!assetPoolId) return 0;
  const pool = pools.find((p) => p.id === assetPoolId);
  return pool ? accountsBalance(txs, pool.accountIds) : 0;
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
 */
export function evaluateDistribution(
  group: SectionGroup,
  sections: Section[],
  txs: Transaction[],
  pools: AssetPool[] = []
): DistributionGroup {
  const total = summarize(txs).income;
  const members = sectionsOfGroup(group, sections).filter((s) => s.calc.type !== 'target');

  // First pass: planned for everything except remainder.
  const planned = new Map<string, number>();
  for (const s of members) {
    const c = s.calc;
    if (c.type === 'percentage') planned.set(s.id, Math.round((c.percent / 100) * total));
    else if (c.type === 'fixed') planned.set(s.id, c.amount);
    else if (c.type === 'filterSum') planned.set(s.id, c.planned ?? 0);
    else if (c.type === 'accountBalance') planned.set(s.id, Math.abs(poolBalance(pools, c.assetPoolId, txs)));
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
    // filterSum sections draw a real actual from matching transactions; the
    // others (percentage/fixed/remainder/accountBalance) carry actual == planned
    // (a balance and the allocation intents have no separate "actual"). Actual is
    // a positive magnitude to match how planned is expressed.
    const actual = s.calc.type === 'filterSum' ? Math.abs(filterSum(txs, s.calc.filter)) : p;
    return { id: s.id, name: s.name, color: s.color, kind, plannedPct, planned: p, actual };
  });

  return { id: group.id, name: group.name, source: 'Income', total, sections: distSections };
}

/**
 * Extract `target` sections as goal-progress items, ordered. `current` reads the
 * linked asset pool's balance when `assetPoolId` is set, else 0.
 */
export function evaluateTargets(
  sections: Section[],
  txs: Transaction[] = [],
  pools: AssetPool[] = []
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
        current: Math.max(0, poolBalance(pools, c.assetPoolId, txs)),
        target: c.targetAmount,
        targetDate: c.targetDate
      };
    });
}

export interface EvaluatedGroup {
  group: SectionGroup;
  /** Planned-vs-actual distribution for the group's allocation sections. */
  distribution: DistributionGroup;
  /** Goal-progress items for the group's `target` sections. */
  targets: TargetSection[];
}

/** Evaluate every group in config order, pairing distribution + targets per group. */
export function evaluatePlan(
  groups: SectionGroup[],
  sections: Section[],
  txs: Transaction[],
  pools: AssetPool[] = []
): EvaluatedGroup[] {
  return [...groups]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      group,
      distribution: evaluateDistribution(group, sections, txs, pools),
      targets: evaluateTargets(sectionsOfGroup(group, sections), txs, pools)
    }));
}
