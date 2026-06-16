import { describe, it, expect } from 'vitest';
import { applyRules } from '../../src/lib/rules/engine';
import type { Transaction, Rule } from '../../src/lib/types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    fingerprint: 'fp1',
    date: '2026-01-15',
    amount: -5000,
    label: 'ALDI SUPERMARKET #42',
    normalizedLabel: 'aldi supermarket #42',
    accountId: null,
    categoryId: null,
    entity: null,
    tagIds: [],
    importedAt: '2026-01-16T00:00:00Z',
    source: 'test.csv',
    ...overrides
  };
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    priority: 1,
    enabled: true,
    match: { field: 'label', type: 'keyword', value: 'aldi', caseSensitive: false },
    setCategoryId: 'cat-groceries',
    ...overrides
  };
}

describe('applyRules', () => {
  it('returns unchanged transactions when no rules', () => {
    const tx = makeTx();
    const result = applyRules([tx], []);
    expect(result[0]).toBe(tx); // same reference (no copy needed)
  });

  it('skips disabled rules', () => {
    const tx = makeTx();
    const rule = makeRule({ enabled: false });
    const [result] = applyRules([tx], [rule]);
    expect(result.categoryId).toBeNull();
  });

  it('applies keyword match on normalizedLabel (case-insensitive)', () => {
    const tx = makeTx();
    const rule = makeRule();
    const [result] = applyRules([tx], [rule]);
    expect(result.categoryId).toBe('cat-groceries');
  });

  it('respects caseSensitive flag', () => {
    const tx = makeTx();
    const rule = makeRule({
      match: { field: 'label', type: 'keyword', value: 'ALDI', caseSensitive: true }
    });
    const [result] = applyRules([tx], [rule]);
    expect(result.categoryId).toBe('cat-groceries');
  });

  it('does not match when keyword absent', () => {
    const tx = makeTx({ normalizedLabel: 'starbucks' });
    const rule = makeRule();
    const [result] = applyRules([tx], [rule]);
    expect(result.categoryId).toBeNull();
  });

  it('applies regex match', () => {
    const tx = makeTx();
    const rule = makeRule({
      match: { field: 'label', type: 'regex', value: 'aldi\\s+\\w+', caseSensitive: false }
    });
    const [result] = applyRules([tx], [rule]);
    expect(result.categoryId).toBe('cat-groceries');
  });

  it('skips rules with invalid regex without throwing', () => {
    const tx = makeTx();
    const rule = makeRule({
      match: { field: 'label', type: 'regex', value: '[invalid', caseSensitive: false }
    });
    const [result] = applyRules([tx], [rule]);
    expect(result.categoryId).toBeNull();
  });

  it('matches on entity field', () => {
    const tx = makeTx({ entity: 'Netflix' });
    const rule = makeRule({
      match: { field: 'entity', type: 'keyword', value: 'netflix', caseSensitive: false },
      setCategoryId: 'cat-subscriptions'
    });
    const [result] = applyRules([tx], [rule]);
    expect(result.categoryId).toBe('cat-subscriptions');
  });

  it('sets entity via rule', () => {
    const tx = makeTx();
    const rule = makeRule({ setCategoryId: undefined, setEntity: 'Aldi' });
    const [result] = applyRules([tx], [rule]);
    expect(result.entity).toBe('Aldi');
  });

  it('merges addTagIds without duplicates', () => {
    const tx = makeTx({ tagIds: ['tag-food'] });
    const rule = makeRule({
      setCategoryId: undefined,
      addTagIds: ['tag-food', 'tag-essential']
    });
    const [result] = applyRules([tx], [rule]);
    expect(result.tagIds).toEqual(expect.arrayContaining(['tag-food', 'tag-essential']));
    expect(result.tagIds.filter((t) => t === 'tag-food')).toHaveLength(1);
  });

  it('applies rules in priority order (lower priority number first)', () => {
    const tx = makeTx();
    const rules: Rule[] = [
      makeRule({ id: 'r2', priority: 2, setCategoryId: 'cat-b' }),
      makeRule({ id: 'r1', priority: 1, setCategoryId: 'cat-a' })
    ];
    const [result] = applyRules([tx], rules);
    // Both match; r1 (priority=1) runs first, r2 (priority=2) overwrites
    expect(result.categoryId).toBe('cat-b');
  });

  it('does not mutate original transaction', () => {
    const tx = makeTx();
    const rule = makeRule();
    applyRules([tx], [rule]);
    expect(tx.categoryId).toBeNull();
  });
});
