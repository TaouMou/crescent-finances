/**
 * Pure rule engine. Rules are sorted by priority (lower number = higher precedence),
 * then applied to each transaction in order. All matching rules are applied
 * (not just the first), so later rules can stack tag additions.
 */

import type { Transaction, Rule } from '$lib/types';

function matches(tx: Transaction, rule: Rule): boolean {
  const { match } = rule;
  let haystack: string;

  if (match.field === 'label') {
    haystack = match.caseSensitive ? tx.label : tx.normalizedLabel;
  } else {
    haystack = match.caseSensitive ? (tx.entity ?? '') : (tx.entity ?? '').toLowerCase();
  }

  if (match.type === 'keyword') {
    const needle = match.caseSensitive ? match.value : match.value.toLowerCase();
    return haystack.includes(needle);
  }

  // regex
  try {
    return new RegExp(match.value, match.caseSensitive ? '' : 'i').test(haystack);
  } catch {
    return false;
  }
}

/**
 * Apply enabled rules (sorted by priority asc) to every transaction.
 * Returns new Transaction objects; originals are never mutated.
 */
export function applyRules(txs: Transaction[], rules: Rule[]): Transaction[] {
  const enabled = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  if (enabled.length === 0) return txs;

  return txs.map((tx) => {
    let result = tx;

    for (const rule of enabled) {
      if (!matches(result, rule)) continue;

      const next: Transaction = { ...result };
      if (rule.setCategoryId !== undefined) next.categoryId = rule.setCategoryId;
      if (rule.setEntity !== undefined) next.entity = rule.setEntity;
      if (rule.addTagIds?.length) {
        const merged = new Set([...result.tagIds, ...rule.addTagIds]);
        next.tagIds = [...merged];
      }
      result = next;
    }

    return result;
  });
}
