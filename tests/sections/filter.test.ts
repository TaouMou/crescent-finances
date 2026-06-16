import { describe, it, expect } from 'vitest';
import { matchesFilter, filterSum } from '../../src/lib/sections/filter';
import type { Transaction, TransactionFilter } from '../../src/lib/types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    fingerprint: 'fp1',
    date: '2026-01-15',
    amount: -5000,
    label: 'Aldi Store #42',
    normalizedLabel: 'aldi store #42',
    accountId: null,
    categoryId: null,
    entity: null,
    tagIds: [],
    importedAt: '2026-01-16T00:00:00Z',
    source: 'test.csv',
    ...overrides
  };
}

describe('matchesFilter', () => {
  it('empty filter matches everything', () => {
    expect(matchesFilter(makeTx(), {})).toBe(true);
  });

  it('categoryIds: hit and miss; null categoryId never matches a constraint', () => {
    const f: TransactionFilter = { categoryIds: ['groceries'] };
    expect(matchesFilter(makeTx({ categoryId: 'groceries' }), f)).toBe(true);
    expect(matchesFilter(makeTx({ categoryId: 'rent' }), f)).toBe(false);
    expect(matchesFilter(makeTx({ categoryId: null }), f)).toBe(false);
  });

  it('accountIds: hit and miss; null accountId never matches a constraint', () => {
    const f: TransactionFilter = { accountIds: ['checking'] };
    expect(matchesFilter(makeTx({ accountId: 'checking' }), f)).toBe(true);
    expect(matchesFilter(makeTx({ accountId: 'savings' }), f)).toBe(false);
    expect(matchesFilter(makeTx({ accountId: null }), f)).toBe(false);
  });

  it('tagIds: matches on any overlap, fails with no overlap', () => {
    const f: TransactionFilter = { tagIds: ['a', 'b'] };
    expect(matchesFilter(makeTx({ tagIds: ['b'] }), f)).toBe(true);
    expect(matchesFilter(makeTx({ tagIds: ['c'] }), f)).toBe(false);
    expect(matchesFilter(makeTx({ tagIds: [] }), f)).toBe(false);
  });

  it('entity: case-insensitive substring; null entity never matches', () => {
    const f: TransactionFilter = { entity: 'aldi' };
    expect(matchesFilter(makeTx({ entity: 'Aldi' }), f)).toBe(true);
    expect(matchesFilter(makeTx({ entity: 'Lidl' }), f)).toBe(false);
    expect(matchesFilter(makeTx({ entity: null }), f)).toBe(false);
  });

  it('query: case-insensitive substring against normalizedLabel', () => {
    expect(matchesFilter(makeTx(), { query: 'ALDI' })).toBe(true);
    expect(matchesFilter(makeTx(), { query: 'tesco' })).toBe(false);
  });

  it('minAmount/maxAmount: inclusive bounds on signed amount', () => {
    expect(matchesFilter(makeTx({ amount: -5000 }), { minAmount: -5000 })).toBe(true);
    expect(matchesFilter(makeTx({ amount: -5001 }), { minAmount: -5000 })).toBe(false);
    expect(matchesFilter(makeTx({ amount: -5000 }), { maxAmount: -5000 })).toBe(true);
    expect(matchesFilter(makeTx({ amount: -4999 }), { maxAmount: -5000 })).toBe(false);
  });

  it('fromDate/toDate: inclusive ISO bounds', () => {
    const f: TransactionFilter = { fromDate: '2026-01-01', toDate: '2026-01-31' };
    expect(matchesFilter(makeTx({ date: '2026-01-01' }), f)).toBe(true);
    expect(matchesFilter(makeTx({ date: '2026-01-31' }), f)).toBe(true);
    expect(matchesFilter(makeTx({ date: '2025-12-31' }), f)).toBe(false);
    expect(matchesFilter(makeTx({ date: '2026-02-01' }), f)).toBe(false);
  });

  it('multi-clause AND: matches only when every present clause holds', () => {
    const f: TransactionFilter = { categoryIds: ['groceries'], query: 'aldi' };
    expect(matchesFilter(makeTx({ categoryId: 'groceries' }), f)).toBe(true);
    // category matches but label does not
    expect(
      matchesFilter(makeTx({ categoryId: 'groceries', normalizedLabel: 'tesco' }), f)
    ).toBe(false);
  });

  it('empty array clauses impose no constraint', () => {
    expect(matchesFilter(makeTx({ categoryId: null, tagIds: [] }), { categoryIds: [], tagIds: [] })).toBe(true);
  });
});

describe('filterSum', () => {
  it('sums signed amounts of matching transactions', () => {
    const txs = [
      makeTx({ id: 'a', categoryId: 'groceries', amount: -5000 }),
      makeTx({ id: 'b', categoryId: 'groceries', amount: -3000 }),
      makeTx({ id: 'c', categoryId: 'rent', amount: -100000 })
    ];
    expect(filterSum(txs, { categoryIds: ['groceries'] })).toBe(-8000);
  });

  it('returns 0 when nothing matches', () => {
    const txs = [makeTx({ categoryId: 'rent' })];
    expect(filterSum(txs, { categoryIds: ['groceries'] })).toBe(0);
  });
});
