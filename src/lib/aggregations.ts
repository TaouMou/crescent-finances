/**
 * Pure aggregation functions over decrypted Transaction[].
 * All amounts in integer minor units (cents). Negative = expense.
 */

import type { Category, Transaction } from '$lib/types';

export interface PeriodSummary {
  income: number;
  spending: number; // absolute (positive)
  net: number;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number; // absolute spending, positive
}

export interface MonthlyNet {
  bucket: string; // YYYY-MM
  income: number;
  spending: number; // absolute
  net: number;
  /** Cumulative net from earliest bucket to this one. */
  cumulative: number;
}

function inPeriod(tx: Transaction, from?: string, to?: string): boolean {
  if (from && tx.date < from) return false;
  if (to && tx.date > to) return false;
  return true;
}

export function summarize(txs: Transaction[], from?: string, to?: string): PeriodSummary {
  let income = 0;
  let spending = 0;
  for (const tx of txs) {
    if (!inPeriod(tx, from, to)) continue;
    if (tx.amount > 0) income += tx.amount;
    else spending += tx.amount;
  }
  return { income, spending: Math.abs(spending), net: income + spending };
}

export function categoryBreakdown(
  txs: Transaction[],
  categories: Category[],
  from?: string,
  to?: string
): CategoryBreakdown[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string | null, number>();

  for (const tx of txs) {
    if (tx.amount >= 0) continue; // expenses only
    if (!inPeriod(tx, from, to)) continue;
    const key = tx.categoryId;
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(tx.amount));
  }

  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([id, amount]) => {
      const cat = id ? catMap.get(id) : undefined;
      return {
        categoryId: id,
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? '#9A9FA5',
        amount
      };
    });
}

export function monthlyNets(txs: Transaction[]): MonthlyNet[] {
  const byBucket = new Map<string, { income: number; spending: number }>();

  for (const tx of txs) {
    const bucket = tx.date.slice(0, 7);
    if (!byBucket.has(bucket)) byBucket.set(bucket, { income: 0, spending: 0 });
    const entry = byBucket.get(bucket)!;
    if (tx.amount > 0) entry.income += tx.amount;
    else entry.spending += tx.amount;
  }

  const sorted = [...byBucket.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumulative = 0;
  return sorted.map(([bucket, { income, spending }]) => {
    const net = income + spending;
    cumulative += net;
    return { bucket, income, spending: Math.abs(spending), net, cumulative };
  });
}

/**
 * Daily cumulative net series for the line chart.
 * Returns one point per day in [from, to], carrying the running balance from
 * all transactions (including those before `from`).
 * Returns [] when there are no transactions in the selected range.
 */
export function dailyCumulative(
  txs: Transaction[],
  from: string,
  to: string
): { t: number; value: number }[] {
  if (txs.length === 0) return [];

  const byDate = new Map<string, number>();
  for (const tx of txs) {
    byDate.set(tx.date, (byDate.get(tx.date) ?? 0) + tx.amount);
  }

  const hasInRange = [...byDate.keys()].some((d) => d >= from && d <= to);
  if (!hasInRange) return [];

  let cumulative = 0;
  for (const [date, net] of byDate) {
    if (date < from) cumulative += net;
  }

  const points: { t: number; value: number }[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    cumulative += byDate.get(dateStr) ?? 0;
    points.push({ t: Math.floor(d.getTime() / 1000), value: cumulative });
  }
  return points;
}
