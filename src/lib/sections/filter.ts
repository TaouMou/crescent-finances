/**
 * Pure transaction-filter matching. Mirrors the style of src/lib/aggregations.ts
 * (no Svelte/DOM globals, vitest-friendly). Drives the `filterSum` section calc:
 * the set of transactions a section's *actual* amount is summed from.
 *
 * Money is integer minor units (cents), signed: negative = expense.
 */

import type { Transaction, TransactionFilter } from '$lib/types';

/** True if `value` contains `needle`, case-insensitively. */
function ciIncludes(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle.toLowerCase());
}

/**
 * True if `tx` satisfies every present clause of `filter` (AND across clauses).
 * Array clauses match when the transaction matches ANY of their entries
 * ("any-of"). Absent or empty clauses impose no constraint, so an empty filter
 * (`{}`) matches every transaction.
 */
export function matchesFilter(tx: Transaction, filter: TransactionFilter): boolean {
  if (filter.categoryIds?.length) {
    if (tx.categoryId === null || !filter.categoryIds.includes(tx.categoryId)) return false;
  }
  if (filter.accountIds?.length) {
    if (tx.accountId === null || !filter.accountIds.includes(tx.accountId)) return false;
  }
  if (filter.tagIds?.length) {
    if (!filter.tagIds.some((id) => tx.tagIds.includes(id))) return false;
  }
  if (filter.entity) {
    if (tx.entity === null || !ciIncludes(tx.entity, filter.entity)) return false;
  }
  if (filter.query) {
    // normalizedLabel is already lowercased at import; ciIncludes lowercases both.
    if (!ciIncludes(tx.normalizedLabel, filter.query)) return false;
  }
  if (filter.minAmount !== undefined && tx.amount < filter.minAmount) return false;
  if (filter.maxAmount !== undefined && tx.amount > filter.maxAmount) return false;
  // ISO dates compare correctly as plain strings.
  if (filter.fromDate && tx.date < filter.fromDate) return false;
  if (filter.toDate && tx.date > filter.toDate) return false;
  return true;
}

/**
 * Signed sum of `tx.amount` over transactions matching `filter`. The caller
 * decides whether to take the absolute magnitude (filterSum sections express
 * actual as a positive magnitude to match how planned is expressed). A filter
 * matching a mix of income and expense nets them before returning.
 */
export function filterSum(txs: Transaction[], filter: TransactionFilter): number {
  let sum = 0;
  for (const tx of txs) {
    if (matchesFilter(tx, filter)) sum += tx.amount;
  }
  return sum;
}
