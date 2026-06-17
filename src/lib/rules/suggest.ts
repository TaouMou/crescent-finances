/**
 * Pure category suggestion. Infers a category for still-uncategorized
 * transactions by matching them against how prior transactions were
 * categorized — exact entity first, then exact normalized label. Only a single
 * dominant category is suggested, to avoid guessing on ambiguous history.
 *
 * No Svelte/DOM globals — mirrors src/lib/rules/engine.ts so vitest covers it.
 */

import type { Transaction } from '$lib/types';

/** Fraction of a key's categorized history that must agree to suggest it. */
const DOMINANCE = 0.5;

/** categoryId -> count, returning the dominant id when it clears DOMINANCE. */
function dominant(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  let total = 0;
  for (const [id, n] of counts) {
    total += n;
    if (n > bestCount) {
      best = id;
      bestCount = n;
    }
  }
  if (best === null || total === 0) return null;
  return bestCount / total > DOMINANCE ? best : null;
}

function bumpKey(map: Map<string, Map<string, number>>, key: string, categoryId: string): void {
  let counts = map.get(key);
  if (!counts) map.set(key, (counts = new Map()));
  counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
}

/**
 * Suggest a categoryId for each still-uncategorized transaction in
 * `toCategorize`, learned from the categorized rows in `history`. Returns a map
 * of transaction id -> suggested categoryId (only confident matches included).
 * Inputs that already have a category are ignored.
 */
export function suggestCategories(
  toCategorize: Transaction[],
  history: Transaction[]
): Map<string, string> {
  const byEntity = new Map<string, Map<string, number>>();
  const byLabel = new Map<string, Map<string, number>>();
  for (const tx of history) {
    if (tx.categoryId === null) continue;
    if (tx.entity) bumpKey(byEntity, tx.entity.toLowerCase(), tx.categoryId);
    if (tx.normalizedLabel) bumpKey(byLabel, tx.normalizedLabel, tx.categoryId);
  }

  const out = new Map<string, string>();
  for (const tx of toCategorize) {
    if (tx.categoryId !== null) continue;
    const entityHit = tx.entity ? dominant(byEntity.get(tx.entity.toLowerCase()) ?? new Map()) : null;
    const labelHit = entityHit ?? dominant(byLabel.get(tx.normalizedLabel) ?? new Map());
    if (labelHit) out.set(tx.id, labelHit);
  }
  return out;
}
