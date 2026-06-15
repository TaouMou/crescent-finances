<script lang="ts">
  import { formatMoney } from '$lib/utils/currency';
  import type { CategorySpend } from '$lib/seed/dashboard';

  let {
    data,
    currency = 'EUR',
    locale = 'en-US'
  }: { data: CategorySpend[]; currency?: string; locale?: string } = $props();

  const max = $derived(Math.max(...data.map((d) => d.amount), 1));
  const total = $derived(data.reduce((s, d) => s + d.amount, 0));
</script>

<div class="space-y-3">
  {#each data as row, i (row.name)}
    <div class="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
      <div class="flex items-center gap-2 text-sm text-ink">
        <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={`background:${row.color}`}></span>
        <span class="truncate">{row.name}</span>
      </div>
      <span class="tnum text-sm text-ink">{formatMoney(row.amount, { currency, locale })}</span>
      <div class="col-span-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
        <div
          class="h-full rounded-full origin-left"
          style={`background:${row.color};transform:scaleX(${row.amount / max});transition:transform var(--dur-slow) var(--ease-out) ${i * 40}ms`}
        ></div>
      </div>
    </div>
  {/each}
</div>

<div class="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-sm">
  <span class="text-muted">Total spending</span>
  <span class="tnum font-medium text-ink">{formatMoney(total, { currency, locale })}</span>
</div>
