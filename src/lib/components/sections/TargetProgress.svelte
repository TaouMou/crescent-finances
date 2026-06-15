<script lang="ts">
  import { formatMoney } from '$lib/utils/currency';
  import type { TargetSection } from '$lib/seed/dashboard';

  let {
    items,
    currency = 'EUR',
    locale = 'en-US'
  }: { items: TargetSection[]; currency?: string; locale?: string } = $props();

  const fmt = (n: number) => formatMoney(n, { currency, locale });
  const pct = (t: TargetSection) => Math.min(100, Math.round((t.current / t.target) * 100));
</script>

<div class="space-y-4">
  {#each items as t (t.id)}
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={`background:${t.color}`}></span>
          <span class="truncate text-sm text-ink">{t.name}</span>
        </div>
        <span class="tnum shrink-0 whitespace-nowrap text-sm text-muted">
          {fmt(t.current)} <span class="text-muted/60">/ {fmt(t.target)}</span>
        </span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
        <div
          class="h-full rounded-full origin-left"
          style={`width:${pct(t)}%;background:${t.color};transition:width var(--dur-slow) var(--ease-out)`}
        ></div>
      </div>
      <div class="flex justify-between text-xs text-muted">
        <span class="tnum">{pct(t)}%</span>
        {#if t.targetDate}
          <span>by {new Date(t.targetDate).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}</span>
        {/if}
      </div>
    </div>
  {/each}
</div>
