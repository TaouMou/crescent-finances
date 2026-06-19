/**
 * Pure transaction-filter matching. Mirrors the style of src/lib/aggregations.ts
 * (no Svelte/DOM globals, vitest-friendly). Drives the `filterSum` section calc:
 * the set of transactions a section's *actual* amount is summed from.
 *
 * Money is integer minor units (cents), signed: negative = expense.
 */

import type { Transaction, TransactionFilter } from '$lib/types';

/**
 * A filter with its free-text needles lowercased once up front, so a scan over N
 * transactions doesn't re-lowercase the (constant) needle N times.
 */
interface CompiledFilter {
  readonly filter: TransactionFilter;
  readonly entity?: string;
  readonly query?: string;
}

function compileFilter(filter: TransactionFilter): CompiledFilter {
  return {
    filter,
    entity: filter.entity ? filter.entity.toLowerCase() : undefined,
    query: filter.query ? filter.query.toLowerCase() : undefined
  };
}

function matchesCompiled(tx: Transaction, cf: CompiledFilter): boolean {
  const filter = cf.filter;
  if (filter.categoryIds?.length) {
    if (tx.categoryId === null || !filter.categoryIds.includes(tx.categoryId)) return false;
  }
  if (filter.accountIds?.length) {
    if (tx.accountId === null || !filter.accountIds.includes(tx.accountId)) return false;
  }
  if (filter.tagIds?.length) {
    if (!filter.tagIds.some((id) => tx.tagIds.includes(id))) return false;
  }
  if (cf.entity !== undefined) {
    if (tx.entity === null || !tx.entity.toLowerCase().includes(cf.entity)) return false;
  }
  if (cf.query !== undefined) {
    // normalizedLabel is already lowercased at import.
    if (!tx.normalizedLabel.toLowerCase().includes(cf.query)) return false;
  }
  if (filter.minAmount !== undefined && tx.amount < filter.minAmount) return false;
  if (filter.maxAmount !== undefined && tx.amount > filter.maxAmount) return false;
  // ISO dates compare correctly as plain strings.
  if (filter.fromDate && tx.date < filter.fromDate) return false;
  if (filter.toDate && tx.date > filter.toDate) return false;
  return true;
}

/**
 * True if `tx` satisfies every present clause of `filter` (AND across clauses).
 * Array clauses match when the transaction matches ANY of their entries
 * ("any-of"). Absent or empty clauses impose no constraint, so an empty filter
 * (`{}`) matches every transaction.
 */
export function matchesFilter(tx: Transaction, filter: TransactionFilter): boolean {
  return matchesCompiled(tx, compileFilter(filter));
}

/**
 * Signed sum of `tx.amount` over transactions matching `filter`. The caller
 * decides whether to take the absolute magnitude (filterSum sections express
 * actual as a positive magnitude to match how planned is expressed). A filter
 * matching a mix of income and expense nets them before returning.
 */
export function filterSum(txs: Transaction[], filter: TransactionFilter): number {
  const cf = compileFilter(filter);
  let sum = 0;
  for (const tx of txs) {
    if (matchesCompiled(tx, cf)) sum += tx.amount;
  }
  return sum;
}
