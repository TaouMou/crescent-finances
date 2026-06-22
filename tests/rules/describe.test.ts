import { describe, it, expect } from 'vitest';
import { describeMatch, describeActions, matchFieldLabel, matchVerbLabel } from '../../src/lib/rules/describe';
import type { Rule } from '../../src/lib/types';

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    priority: 10,
    enabled: true,
    match: { field: 'label', type: 'keyword', value: 'ALDI', caseSensitive: false },
    ...overrides
  };
}

const categories = [{ id: 'c1', name: 'Groceries' }];
const tags = [
  { id: 't1', name: 'Work' },
  { id: 't2', name: 'Holiday' }
];

describe('match labels', () => {
  it('maps fields and verbs to user words', () => {
    expect(matchFieldLabel('label')).toBe('description');
    expect(matchFieldLabel('entity')).toBe('merchant');
    expect(matchVerbLabel('keyword')).toBe('contains');
    expect(matchVerbLabel('regex')).toBe('matches regex');
  });

  it('reads as a sentence prefix', () => {
    expect(describeMatch(rule())).toBe('When description contains');
    expect(describeMatch(rule({ match: { field: 'entity', type: 'regex', value: '^X', caseSensitive: false } }))).toBe(
      'When merchant matches regex'
    );
  });
});

describe('describeActions', () => {
  it('summarizes a category action with its name', () => {
    expect(describeActions(rule({ setCategoryId: 'c1' }), categories, tags)).toBe('Set category Groceries');
  });

  it('joins multiple actions and pluralizes tags', () => {
    const r = rule({ setCategoryId: 'c1', setEntity: 'Aldi', addTagIds: ['t1', 't2'] });
    expect(describeActions(r, categories, tags)).toBe('Set category Groceries · Rename to Aldi · Add tags Work, Holiday');
  });

  it('uses singular for one tag', () => {
    expect(describeActions(rule({ addTagIds: ['t1'] }), categories, tags)).toBe('Add tag Work');
  });

  it('falls back to ids when lookups miss', () => {
    expect(describeActions(rule({ setCategoryId: 'gone' }), [], [])).toBe('Set category gone');
  });

  it('says "No actions" when nothing is set', () => {
    expect(describeActions(rule(), categories, tags)).toBe('No actions');
  });
});
