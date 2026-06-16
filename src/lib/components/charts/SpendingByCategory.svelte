<script lang="ts">
  import { formatMoney } from '$lib/utils/currency';
  import type { CategorySpend } from '$lib/seed/dashboard';

  let {
    data,
    currency = 'EUR',
    locale = 'en-US'
  }: { data: CategorySpend[]; currency?: string; locale?: string } = $props();

  const total = $derived(data.reduce((s, d) => s + d.amount, 0));
</script>

<div class="divide-y divide-hairline">
  {#each data as row (row.name)}
    <div class="flex items-center gap-3 py-2.5 text-sm">
      <span class="h-2 w-2 shrink-0 rounded-full" style={`background:${row.color}`}></span>
      <span class="flex-1 truncate text-ink">{row.name}</span>
      <span class="tnum text-xs text-muted">{Math.round((row.amount / total) * 100)}%</span>
      <span class="tnum text-ink">{formatMoney(row.amount, { currency, locale })}</span>
    </div>
  {/each}
</div>

<div class="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-sm">
  <span class="text-muted">Total spending</span>
  <span class="tnum font-medium text-ink">{formatMoney(total, { currency, locale })}</span>
</div>
