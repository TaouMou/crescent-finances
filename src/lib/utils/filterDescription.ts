import type { Account, AppConfig, Category, Tag, TransactionFilter } from '$lib/types';

/**
 * Human-readable summary of a TransactionFilter, e.g.
 * "Groceries, Dining · Checking · #travel · \"coffee\""
 * Falls back to "All transactions" for an empty filter.
 */
export function describeFilter(filter: TransactionFilter, config: AppConfig): string {
  const parts: string[] = [];

  if (filter.categoryIds?.length) {
    const names = filter.categoryIds
      .map((id) => config.categories.find((c: Category) => c.id === id)?.name)
      .filter((n): n is string => n !== undefined);
    if (names.length) parts.push(names.join(', '));
  }

  if (filter.accountIds?.length) {
    const names = filter.accountIds
      .map((id) => config.accounts.find((a: Account) => a.id === id)?.name)
      .filter((n): n is string => n !== undefined);
    if (names.length) parts.push(names.join(', '));
  }

  if (filter.tagIds?.length) {
    const names = filter.tagIds
      .map((id) => config.tags.find((t: Tag) => t.id === id)?.name)
      .filter((n): n is string => n !== undefined)
      .map((n) => `#${n}`);
    if (names.length) parts.push(names.join(' '));
  }

  if (filter.entity) parts.push(`@${filter.entity}`);
  if (filter.query) parts.push(`"${filter.query}"`);

  return parts.join(' · ') || 'All transactions';
}
