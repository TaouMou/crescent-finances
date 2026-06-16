import { describe, it, expect } from 'vitest';
import {
  evaluateDistribution,
  evaluateTargets,
  evaluatePlan,
  sectionsOfGroup
} from '../../src/lib/sections/engine';
import type { Section, SectionGroup, Transaction } from '../../src/lib/types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    fingerprint: 'fp1',
    date: '2026-01-15',
    amount: -5000,
    label: 'X',
    normalizedLabel: 'x',
    accountId: null,
    categoryId: null,
    entity: null,
    tagIds: [],
    importedAt: '2026-01-16T00:00:00Z',
    source: 'test.csv',
    ...overrides
  };
}

function makeSection(overrides: Partial<Section> & Pick<Section, 'id' | 'calc'>): Section {
  return {
    name: overrides.name ?? overrides.id,
    color: '#0DA882',
    groupId: 'g1',
    order: 0,
    ...overrides
  };
}

const group: SectionGroup = { id: 'g1', name: 'Monthly plan', order: 0, kind: 'distribution', sectionIds: [] };

// 4000.00 income (minor units), 1000.00 expense.
const txs: Transaction[] = [makeTx({ amount: 400_000 }), makeTx({ id: 'tx2', amount: -100_000 })];

describe('sectionsOfGroup', () => {
  it('matches by back-reference and by membership list, de-duped and ordered', () => {
    const a = makeSection({ id: 'a', order: 2, calc: { type: 'fixed', amount: 1 } });
    const b = makeSection({ id: 'b', order: 1, groupId: null, calc: { type: 'fixed', amount: 1 } });
    const grp: SectionGroup = { ...group, sectionIds: ['b'] };
    const result = sectionsOfGroup(grp, [a, b]);
    expect(result.map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('evaluateDistribution', () => {
  it('computes percentage planned against income', () => {
    const savings = makeSection({ id: 's1', name: 'Savings', order: 0, calc: { type: 'percentage', of: { kind: 'income' }, percent: 30 } });
    const dist = evaluateDistribution(group, [savings], txs);
    expect(dist.total).toBe(400_000);
    expect(dist.source).toBe('Income');
    expect(dist.sections[0].planned).toBe(120_000);
    expect(dist.sections[0].plannedPct).toBe(30);
    // percentage sections have no tx linkage, so actual mirrors planned
    expect(dist.sections[0].actual).toBe(120_000);
  });

  it('uses fixed amount and derives its pct of income', () => {
    const rent = makeSection({ id: 's2', name: 'Rent', order: 0, calc: { type: 'fixed', amount: 100_000 } });
    const dist = evaluateDistribution(group, [rent], txs);
    expect(dist.sections[0].planned).toBe(100_000);
    expect(dist.sections[0].plannedPct).toBe(25);
  });

  it('remainder absorbs income left after the other sections', () => {
    const savings = makeSection({ id: 's1', name: 'Savings', order: 0, calc: { type: 'percentage', of: { kind: 'income' }, percent: 30 } });
    const fixed = makeSection({ id: 's2', name: 'Rent', order: 1, calc: { type: 'fixed', amount: 100_000 } });
    const rest = makeSection({ id: 's3', name: 'Spending', order: 2, calc: { type: 'remainder' } });
    const dist = evaluateDistribution(group, [savings, fixed, rest], txs);
    // 400_000 - 120_000 - 100_000 = 180_000
    expect(dist.sections[2].planned).toBe(180_000);
    expect(dist.sections[2].plannedPct).toBeUndefined();
  });

  it('clamps remainder at zero when over-allocated', () => {
    const big = makeSection({ id: 's1', order: 0, calc: { type: 'fixed', amount: 500_000 } });
    const rest = makeSection({ id: 's2', order: 1, calc: { type: 'remainder' } });
    const dist = evaluateDistribution(group, [big, rest], txs);
    expect(dist.sections[1].planned).toBe(0);
  });

  it('excludes target and accountBalance sections from the distribution bars', () => {
    const goal = makeSection({ id: 's1', order: 0, calc: { type: 'target', targetAmount: 800_000 } });
    const dist = evaluateDistribution(group, [goal], txs);
    expect(dist.sections).toHaveLength(0);
  });

  it('handles empty config / no income without dividing by zero', () => {
    const dist = evaluateDistribution(group, [], []);
    expect(dist.total).toBe(0);
    expect(dist.sections).toEqual([]);
  });

  it('filterSum draws a real actual (abs of matching txs) distinct from planned', () => {
    // Income 400_000; groceries spending of -8000 across two matching txs.
    const data: Transaction[] = [
      makeTx({ amount: 400_000 }),
      makeTx({ id: 'g1', amount: -5000, categoryId: 'groceries' }),
      makeTx({ id: 'g2', amount: -3000, categoryId: 'groceries' }),
      makeTx({ id: 'r1', amount: -100_000, categoryId: 'rent' })
    ];
    const tracked = makeSection({
      id: 's1',
      name: 'Groceries',
      order: 0,
      calc: { type: 'filterSum', filter: { categoryIds: ['groceries'] }, planned: 10_000 }
    });
    const dist = evaluateDistribution(group, [tracked], data);
    expect(dist.sections[0].planned).toBe(10_000);
    expect(dist.sections[0].actual).toBe(8000);
  });

  it('filterSum actual is 0 when no transactions match', () => {
    const tracked = makeSection({
      id: 's1',
      order: 0,
      calc: { type: 'filterSum', filter: { categoryIds: ['nope'] }, planned: 10_000 }
    });
    const dist = evaluateDistribution(group, [tracked], txs);
    expect(dist.sections[0].actual).toBe(0);
  });

  it('mixed group: percentage mirrors planned, filterSum diverges', () => {
    const data: Transaction[] = [
      makeTx({ amount: 400_000 }),
      makeTx({ id: 'g1', amount: -8000, categoryId: 'groceries' })
    ];
    const savings = makeSection({ id: 's1', order: 0, calc: { type: 'percentage', of: { kind: 'income' }, percent: 30 } });
    const tracked = makeSection({ id: 's2', order: 1, calc: { type: 'filterSum', filter: { categoryIds: ['groceries'] }, planned: 10_000 } });
    const dist = evaluateDistribution(group, [savings, tracked], data);
    expect(dist.sections[0].actual).toBe(dist.sections[0].planned); // percentage mirrors
    expect(dist.sections[1].actual).toBe(8000);
    expect(dist.sections[1].planned).toBe(10_000);
  });
});

describe('evaluateTargets', () => {
  it('extracts target sections with current=0 and the configured target', () => {
    const goal = makeSection({ id: 't1', name: 'Emergency fund', order: 0, calc: { type: 'target', targetAmount: 800_000, targetDate: '2026-12-01' } });
    const other = makeSection({ id: 's1', order: 1, calc: { type: 'fixed', amount: 1 } });
    const targets = evaluateTargets([goal, other]);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ id: 't1', name: 'Emergency fund', current: 0, target: 800_000, targetDate: '2026-12-01' });
  });
});

describe('evaluatePlan', () => {
  it('pairs distribution + targets per group, in group order', () => {
    const g2: SectionGroup = { id: 'g2', name: 'Goals', order: 1, kind: 'plain', sectionIds: [] };
    const savings = makeSection({ id: 's1', order: 0, calc: { type: 'percentage', of: { kind: 'income' }, percent: 30 } });
    const goal = makeSection({ id: 't1', order: 0, groupId: 'g2', calc: { type: 'target', targetAmount: 800_000 } });
    const result = evaluatePlan([g2, group], [savings, goal], txs);
    expect(result.map((r) => r.group.id)).toEqual(['g1', 'g2']);
    expect(result[0].distribution.sections).toHaveLength(1);
    expect(result[1].targets).toHaveLength(1);
  });
});
