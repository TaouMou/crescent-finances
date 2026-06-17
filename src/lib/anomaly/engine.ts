/**
 * Pure anomaly-detection engine. Reads the user's saved AnomalySettings and a
 * decrypted Transaction[], flags categories whose spending in the current month
 * is a robust outlier above their recent baseline. No Svelte/DOM globals —
 * mirrors src/lib/aggregations.ts so vitest can cover it directly.
 *
 * Money is integer minor units (cents), signed: negative = expense.
 */

import type { AnomalySettings, Category, Transaction } from '$lib/types';
import type { AnomalyFlag } from '$lib/seed/dashboard';

/** A category needs at least this many prior monthly buckets to baseline against. */
const MIN_BASELINE_BUCKETS = 3;

/** Median of a non-empty numeric list. Returns 0 for an empty list. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Flag categories overspending in the current month relative to their baseline.
 *
 * For each named category (Uncategorized is skipped), spend is bucketed by month
 * (positive magnitude, expenses only). The baseline is the `baselineMonths`
 * buckets immediately preceding the current month; categories with fewer than
 * MIN_BASELINE_BUCKETS of history are skipped (too noisy to judge). A category
 * is flagged when ALL hold:
 *   - current > baseline median (overspend direction only),
 *   - current − median ≥ minAbsolute (absolute floor),
 *   - (current − median) / median ≥ thresholdPct (relative floor; skipped when
 *     median is 0, in which case the absolute floor alone qualifies),
 *   - current − median > madK · MAD (robust outlier; when MAD is 0 the pct +
 *     absolute floors stand in).
 *
 * `now` is the current month (YYYY-MM); injectable for deterministic tests.
 */
export function detectAnomalies(
  txs: Transaction[],
  categories: Category[],
  settings: AnomalySettings,
  now: string = new Date().toISOString().slice(0, 7)
): AnomalyFlag[] {
  const currentBucket = now.slice(0, 7);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // categoryId -> (YYYY-MM -> positive spend magnitude)
  const byCat = new Map<string, Map<string, number>>();
  for (const tx of txs) {
    if (tx.amount >= 0) continue; // expenses only
    if (tx.categoryId === null) continue; // anomalies need a named category
    const bucket = tx.date.slice(0, 7);
    let m = byCat.get(tx.categoryId);
    if (!m) byCat.set(tx.categoryId, (m = new Map()));
    m.set(bucket, (m.get(bucket) ?? 0) + Math.abs(tx.amount));
  }

  const flags: AnomalyFlag[] = [];
  for (const [categoryId, buckets] of byCat) {
    const current = buckets.get(currentBucket) ?? 0;
    const baseline = [...buckets.entries()]
      .filter(([b]) => b < currentBucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-settings.baselineMonths)
      .map(([, v]) => v);
    if (baseline.length < MIN_BASELINE_BUCKETS) continue;

    const med = median(baseline);
    const mad = median(baseline.map((v) => Math.abs(v - med)));
    const delta = current - med;

    if (delta <= 0) continue; // overspend only
    if (med === 0) continue; // no real baseline → no meaningful comparison
    if (delta < settings.minAbsolute) continue;
    if ((delta / med) * 100 < settings.thresholdPct) continue;
    if (mad > 0 && delta <= settings.madK * mad) continue;

    const deltaPct = Math.round((delta / med) * 100);
    const name = catMap.get(categoryId)?.name ?? categoryId;
    flags.push({
      id: `anomaly-${categoryId}`,
      category: name,
      message: `above your ${settings.baselineMonths}-month norm`,
      deltaPct
    });
  }

  return flags.sort((a, b) => b.deltaPct - a.deltaPct);
}
