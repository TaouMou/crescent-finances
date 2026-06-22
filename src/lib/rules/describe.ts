/**
 * Plain-language descriptions of a rule, so the Rules list reads like sentences
 * ("When description contains ALDI → Set category Groceries") instead of a wall
 * of identical-looking "Description" rows. Pure + testable; shared by the
 * mobile and desktop row layouts.
 */

import type { Rule, RuleMatch } from '$lib/types';

type Named = { id: string; name: string };

/** The transaction field a rule looks at, in user words. */
export function matchFieldLabel(field: RuleMatch['field']): string {
  return field === 'label' ? 'description' : 'merchant';
}

/** How the field is compared, in user words. */
export function matchVerbLabel(type: RuleMatch['type']): string {
  return type === 'keyword' ? 'contains' : 'matches regex';
}

/**
 * The match clause without the value (rendered separately as a chip):
 * e.g. "When description contains".
 */
export function describeMatch(rule: Rule): string {
  return `When ${matchFieldLabel(rule.match.field)} ${matchVerbLabel(rule.match.type)}`;
}

/**
 * What the rule does, e.g. "Set category Groceries · Rename to Aldi · Add tags
 * Work, Holiday", or "No actions" when nothing is set.
 */
export function describeActions(rule: Rule, categories: Named[] = [], tags: Named[] = []): string {
  const parts: string[] = [];
  if (rule.setCategoryId) {
    const cat = categories.find((c) => c.id === rule.setCategoryId);
    parts.push(`Set category ${cat?.name ?? rule.setCategoryId}`);
  }
  if (rule.setEntity) parts.push(`Rename to ${rule.setEntity}`);
  if (rule.addTagIds?.length) {
    const names = rule.addTagIds.map((id) => tags.find((t) => t.id === id)?.name ?? id);
    parts.push(`Add tag${names.length > 1 ? 's' : ''} ${names.join(', ')}`);
  }
  return parts.length ? parts.join(' · ') : 'No actions';
}
