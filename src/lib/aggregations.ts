/**
 * Pure aggregation functions over decrypted Transaction[].
 * All amounts in integer minor units (cents). Negative = expense.
 */

import type { Category, StartingBalances, Transaction } from '$lib/types';

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

/**
 * The decrypted transaction array is replaced wholesale whenever the data
 * changes (see stores/transactions.ts), so its identity is a sound cache key:
 * same reference + same params ⇒ same result. Each aggregation keeps a one-entry
 * memo, which collapses the repeat calls a single reactive flush makes — e.g.
 * `summarize(txs, from, to)` runs once per group inside `evaluatePlan`. Callers
 * never mutate the returned value in place, so handing back the cached object is
 * safe.
 */
let _summarizeMemo: { txs: Transaction[]; from?: string; to?: string; out: PeriodSummary } | null =
  null;

export function summarize(txs: Transaction[], from?: string, to?: string): PeriodSummary {
  if (_summarizeMemo && _summarizeMemo.txs === txs && _summarizeMemo.from === from && _summarizeMemo.to === to)
    return _summarizeMemo.out;
  let income = 0;
  let spending = 0;
  for (const tx of txs) {
    if (!inPeriod(tx, from, to)) continue;
    if (tx.amount > 0) income += tx.amount;
    else spending += tx.amount;
  }
  const out = { income, spending: Math.abs(spending), net: income + spending };
  _summarizeMemo = { txs, from, to, out };
  return out;
}

let _breakdownMemo:
  | { txs: Transaction[]; categories: Category[]; from?: string; to?: string; out: CategoryBreakdown[] }
  | null = null;

export function categoryBreakdown(
  txs: Transaction[],
  categories: Category[],
  from?: string,
  to?: string
): CategoryBreakdown[] {
  if (
    _breakdownMemo &&
    _breakdownMemo.txs === txs &&
    _breakdownMemo.categories === categories &&
    _breakdownMemo.from === from &&
    _breakdownMemo.to === to
  )
    return _breakdownMemo.out;
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string | null, number>();

  for (const tx of txs) {
    if (tx.amount >= 0) continue; // expenses only
    if (!inPeriod(tx, from, to)) continue;
    const key = tx.categoryId;
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(tx.amount));
  }

  const out = [...totals.entries()]
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
  _breakdownMemo = { txs, categories, from, to, out };
  return out;
}

/**
 * Net balance of the given accounts: the signed sum of every transaction whose
 * `accountId` is in the set. Used for asset-pool / `accountBalance` calcs and
 * goal `current`. Returns 0 for an empty account list.
 */
export function accountsBalance(txs: Transaction[], accountIds: string[]): number {
  if (accountIds.length === 0) return 0;
  const set = new Set(accountIds);
  let sum = 0;
  for (const tx of txs) {
    if (tx.accountId !== null && set.has(tx.accountId)) sum += tx.amount;
  }
  return sum;
}

/**
 * Current liquid balance — the real money on hand right now, independent of any
 * selected period.
 *
 * For each account that has a starting balance, the balance is that anchor plus
 * the signed sum of its transactions dated on/after the anchor date (earlier
 * rows are already baked into the figure the user entered). Transactions whose
 * account has NO anchor fall back to a plain cumulative sum (anchored at 0), so
 * with zero configuration this is simply the all-time net of everything
 * imported. The `''` key anchors account-less transactions (`accountId === null`).
 */
let _liquidMemo: { txs: Transaction[]; starting: StartingBalances; out: number } | null = null;

export function liquidBalance(txs: Transaction[], starting: StartingBalances = {}): number {
  if (_liquidMemo && _liquidMemo.txs === txs && _liquidMemo.starting === starting) return _liquidMemo.out;
  let total = 0;
  for (const sb of Object.values(starting)) total += sb.amount;
  for (const tx of txs) {
    const anchor = starting[tx.accountId ?? ''];
    if (anchor) {
      if (tx.date >= anchor.asOf) total += tx.amount;
    } else {
      total += tx.amount;
    }
  }
  _liquidMemo = { txs, starting, out: total };
  return total;
}

let _monthlyMemo: { txs: Transaction[]; out: MonthlyNet[] } | null = null;

export function monthlyNets(txs: Transaction[]): MonthlyNet[] {
  if (_monthlyMemo && _monthlyMemo.txs === txs) return _monthlyMemo.out;
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
  const out = sorted.map(([bucket, { income, spending }]) => {
    const net = income + spending;
    cumulative += net;
    return { bucket, income, spending: Math.abs(spending), net, cumulative };
  });
  _monthlyMemo = { txs, out };
  return out;
}
