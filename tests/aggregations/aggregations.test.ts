import { describe, it, expect } from 'vitest';
import {
  summarize,
  categoryBreakdown,
  monthlyNets,
  accountsBalance,
  liquidBalance
} from '../../src/lib/aggregations';
import type { Category, StartingBalances, Transaction } from '../../src/lib/types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    fingerprint: 'fp1',
    date: '2026-01-15',
    amount: -5000,
    label: 'Test',
    normalizedLabel: 'test',
    accountId: null,
    categoryId: null,
    entity: null,
    tagIds: [],
    importedAt: '2026-01-16T00:00:00Z',
    source: 'test',
    ...overrides
  };
}

const categories: Category[] = [
  { id: 'cat-food', name: 'Food', color: '#11aa77', parentId: null },
  { id: 'cat-rent', name: 'Rent', color: '#334455', parentId: null }
];

describe('accountsBalance', () => {
  it('nets the signed amounts of the named accounts only', () => {
    const txs = [
      makeTx({ id: '1', amount: 200_000, accountId: 'a' }),
      makeTx({ id: '2', amount: -50_000, accountId: 'a' }),
      makeTx({ id: '3', amount: 99_000, accountId: 'b' }),
      makeTx({ id: '4', amount: -1000, accountId: null })
    ];
    expect(accountsBalance(txs, ['a'])).toBe(150_000);
    expect(accountsBalance(txs, ['a', 'b'])).toBe(249_000);
    expect(accountsBalance(txs, [])).toBe(0);
    expect(accountsBalance(txs, ['nope'])).toBe(0);
  });
});

describe('liquidBalance', () => {
  it('with no anchors, is the all-time cumulative net of every transaction', () => {
    const txs = [
      makeTx({ id: '1', amount: 300_000 }),
      makeTx({ id: '2', amount: -100_000 }),
      makeTx({ id: '3', amount: -50_000 })
    ];
    expect(liquidBalance(txs)).toBe(150_000);
    expect(liquidBalance(txs, {})).toBe(150_000);
  });

  it('returns 0 with no transactions and no anchors', () => {
    expect(liquidBalance([])).toBe(0);
  });

  it('adds an account anchor plus only that account\'s later transactions', () => {
    const txs = [
      makeTx({ id: '1', amount: -10_000, accountId: 'a', date: '2025-12-31' }), // before asOf → ignored
      makeTx({ id: '2', amount: -20_000, accountId: 'a', date: '2026-01-01' }), // on asOf → counted
      makeTx({ id: '3', amount: 5_000, accountId: 'a', date: '2026-02-01' }) // after → counted
    ];
    const anchors: StartingBalances = { a: { amount: 100_000, asOf: '2026-01-01' } };
    // 100_000 - 20_000 + 5_000 = 85_000 (the 2025 row is baked into the anchor).
    expect(liquidBalance(txs, anchors)).toBe(85_000);
  });

  it('anchors per account and falls back to cumulative for un-anchored ones', () => {
    const txs = [
      makeTx({ id: '1', amount: -20_000, accountId: 'a', date: '2026-02-01' }),
      makeTx({ id: '2', amount: 7_000, accountId: 'b', date: '2026-02-01' }), // no anchor → cumulative
      makeTx({ id: '3', amount: -1_000, accountId: null, date: '2026-02-01' }) // no anchor → cumulative
    ];
    const anchors: StartingBalances = { a: { amount: 100_000, asOf: '2026-01-01' } };
    // a: 100_000 - 20_000 = 80_000; b: +7_000; none: -1_000 → 86_000
    expect(liquidBalance(txs, anchors)).toBe(86_000);
  });

  it('anchors account-less transactions with the empty-string key', () => {
    const txs = [
      makeTx({ id: '1', amount: -3_000, accountId: null, date: '2026-02-01' }),
      makeTx({ id: '2', amount: -9_000, accountId: null, date: '2025-01-01' }) // before asOf → ignored
    ];
    const anchors: StartingBalances = { '': { amount: 50_000, asOf: '2026-01-01' } };
    expect(liquidBalance(txs, anchors)).toBe(47_000);
  });
});

describe('summarize', () => {
  it('separates income and spending', () => {
    const txs = [
      makeTx({ id: '1', amount: 300_000 }),
      makeTx({ id: '2', amount: -100_000 }),
      makeTx({ id: '3', amount: -50_000 })
    ];
    const s = summarize(txs);
    expect(s.income).toBe(300_000);
    expect(s.spending).toBe(150_000);
    expect(s.net).toBe(150_000);
  });

  it('returns zeros for empty array', () => {
    expect(summarize([])).toEqual({ income: 0, spending: 0, net: 0 });
  });

  it('filters by date range', () => {
    const txs = [
      makeTx({ id: '1', date: '2026-01-01', amount: -100 }),
      makeTx({ id: '2', date: '2026-02-01', amount: -200 }),
      makeTx({ id: '3', date: '2026-03-01', amount: -400 })
    ];
    const s = summarize(txs, '2026-01-15', '2026-02-28');
    expect(s.spending).toBe(200); // only Feb
  });
});

describe('categoryBreakdown', () => {
  it('groups expenses by category', () => {
    const txs = [
      makeTx({ id: '1', amount: -5000, categoryId: 'cat-food' }),
      makeTx({ id: '2', amount: -3000, categoryId: 'cat-food' }),
      makeTx({ id: '3', amount: -10000, categoryId: 'cat-rent' })
    ];
    const result = categoryBreakdown(txs, categories);
    const food = result.find((r) => r.categoryId === 'cat-food')!;
    const rent = result.find((r) => r.categoryId === 'cat-rent')!;
    expect(food.amount).toBe(8000);
    expect(rent.amount).toBe(10000);
    expect(result[0].categoryId).toBe('cat-rent'); // sorted desc
  });

  it('groups uncategorized as null key', () => {
    const txs = [makeTx({ id: '1', amount: -5000, categoryId: null })];
    const result = categoryBreakdown(txs, categories);
    expect(result[0].categoryId).toBeNull();
    expect(result[0].name).toBe('Uncategorized');
  });

  it('excludes income transactions', () => {
    const txs = [makeTx({ id: '1', amount: 5000 })];
    const result = categoryBreakdown(txs, categories);
    expect(result).toHaveLength(0);
  });

  it('respects date filter', () => {
    const txs = [
      makeTx({ id: '1', date: '2026-01-10', amount: -1000, categoryId: 'cat-food' }),
      makeTx({ id: '2', date: '2026-02-10', amount: -2000, categoryId: 'cat-food' })
    ];
    const result = categoryBreakdown(txs, categories, '2026-02-01');
    expect(result[0].amount).toBe(2000);
  });
});

describe('monthlyNets', () => {
  it('groups by YYYY-MM bucket', () => {
    const txs = [
      makeTx({ id: '1', date: '2026-01-05', amount: 10000 }),
      makeTx({ id: '2', date: '2026-01-20', amount: -3000 }),
      makeTx({ id: '3', date: '2026-02-10', amount: -5000 })
    ];
    const result = monthlyNets(txs);
    expect(result).toHaveLength(2);
    expect(result[0].bucket).toBe('2026-01');
    expect(result[0].income).toBe(10000);
    expect(result[0].spending).toBe(3000);
    expect(result[0].net).toBe(7000);
    expect(result[1].net).toBe(-5000);
  });

  it('computes cumulative net', () => {
    const txs = [
      makeTx({ id: '1', date: '2026-01-01', amount: 10000 }),
      makeTx({ id: '2', date: '2026-02-01', amount: 5000 })
    ];
    const result = monthlyNets(txs);
    expect(result[0].cumulative).toBe(10000);
    expect(result[1].cumulative).toBe(15000);
  });

  it('returns empty for no transactions', () => {
    expect(monthlyNets([])).toHaveLength(0);
  });
});
