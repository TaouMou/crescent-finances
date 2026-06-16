<script lang="ts">
  import { formatMoney } from '$lib/utils/currency';
  import type { TargetSection } from '$lib/seed/dashboard';

  let {
    items,
    currency = 'EUR',
    locale = 'en-US'
  }: { items: TargetSection[]; currency?: string; locale?: string } = $props();

  const fmt = (n: number) => formatMoney(n, { currency, locale, whole: true });
  const pct = (t: TargetSection) => Math.min(100, Math.round((t.current / t.target) * 100));
</script>

<div class="space-y-4">
  {#each items as t (t.id)}
    <div class="space-y-2">
      <div class="flex items-baseline justify-between gap-2">
        <span class="truncate text-sm text-ink">{t.name}</span>
        <span class="tnum shrink-0 text-sm font-medium text-ink">{pct(t)}%</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
        <div
          class="h-full rounded-full origin-left"
          style={`width:${pct(t)}%;background:${t.color};transition:width var(--dur-slow) var(--ease-out)`}
        ></div>
      </div>
      <p class="tnum truncate text-xs text-muted">
        {fmt(t.current)} of {fmt(t.target)}{#if t.targetDate}&nbsp;· by {new Date(
            t.targetDate
          ).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}{/if}
      </p>
    </div>
  {/each}
</div>
