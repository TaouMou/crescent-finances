import { describe, it, expect } from 'vitest';
import { suggestCategories } from '../../src/lib/rules/suggest';
import type { Transaction } from '../../src/lib/types';

let seq = 0;
function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `tx${seq}`,
    fingerprint: `fp${seq}`,
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

describe('suggestCategories', () => {
  it('suggests by consistent entity history', () => {
    const history = [
      makeTx({ entity: 'Aldi', categoryId: 'groceries' }),
      makeTx({ entity: 'Aldi', categoryId: 'groceries' })
    ];
    const input = [makeTx({ id: 'new1', entity: 'Aldi' })];
    const out = suggestCategories(input, history);
    expect(out.get('new1')).toBe('groceries');
  });

  it('falls back to normalized label when no entity match', () => {
    const history = [makeTx({ normalizedLabel: 'netflix.com', categoryId: 'subs' })];
    const input = [makeTx({ id: 'new1', normalizedLabel: 'netflix.com' })];
    const out = suggestCategories(input, history);
    expect(out.get('new1')).toBe('subs');
  });

  it('does not suggest when history is ambiguous (no dominant category)', () => {
    const history = [
      makeTx({ entity: 'Amazon', categoryId: 'shopping' }),
      makeTx({ entity: 'Amazon', categoryId: 'subs' })
    ];
    const input = [makeTx({ id: 'new1', entity: 'Amazon' })];
    expect(suggestCategories(input, history).has('new1')).toBe(false);
  });

  it('returns an empty map when there is no history', () => {
    const input = [makeTx({ id: 'new1', entity: 'Aldi' })];
    expect(suggestCategories(input, []).size).toBe(0);
  });

  it('ignores inputs that are already categorized', () => {
    const history = [makeTx({ entity: 'Aldi', categoryId: 'groceries' })];
    const input = [makeTx({ id: 'new1', entity: 'Aldi', categoryId: 'rent' })];
    expect(suggestCategories(input, history).has('new1')).toBe(false);
  });

  it('prefers the entity match over the label match', () => {
    const history = [
      makeTx({ entity: 'Shell', normalizedLabel: 'shell 123', categoryId: 'fuel' }),
      makeTx({ entity: 'Shell', normalizedLabel: 'shell 123', categoryId: 'fuel' }),
      makeTx({ entity: null, normalizedLabel: 'shell 123', categoryId: 'misc' })
    ];
    const input = [makeTx({ id: 'new1', entity: 'Shell', normalizedLabel: 'shell 123' })];
    // entity 'Shell' is unanimously fuel even though the label history is mixed.
    expect(suggestCategories(input, history).get('new1')).toBe('fuel');
  });
});
