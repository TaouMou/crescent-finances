<script lang="ts">
  import { Check, Info } from 'lucide-svelte';
  import { formatMoney, formatPercent } from '$lib/utils/currency';
  import type { DistributionGroup } from '$lib/seed/dashboard';

  let {
    group,
    currency = 'EUR',
    locale = 'en-US'
  }: { group: DistributionGroup; currency?: string; locale?: string } = $props();

  const fmt = (n: number) => formatMoney(n, { currency, locale });

  const plannedTotal = $derived(group.sections.reduce((s, x) => s + x.planned, 0));
  const actualTotal = $derived(group.sections.reduce((s, x) => s + x.actual, 0));
  const plannedPctSum = $derived(
    group.sections.reduce((s, x) => s + (x.plannedPct ?? 0), 0)
  );
  const balanced = $derived(Math.round(plannedPctSum) === 100);

  const seg = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
</script>

<div class="space-y-5">
  <div class="flex items-baseline justify-between">
    <div>
      <p class="text-sm text-muted">Source · {group.source}</p>
      <p class="tnum mt-0.5 text-xl font-medium text-ink">{fmt(group.total)}</p>
    </div>
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        balanced ? 'bg-income/12 text-income' : 'bg-warn/12 text-warn'
      }`}
    >
      {#if balanced}
        <Check class="h-3.5 w-3.5" strokeWidth={2} /> Balanced · 100%
      {:else}
        <Info class="h-3.5 w-3.5" strokeWidth={2} /> {formatPercent(plannedPctSum, locale)} allocated
      {/if}
    </span>
  </div>

  <!-- Planned vs actual stacked bars (the signature comparison) -->
  <div class="space-y-3">
    {#each [{ label: 'Planned', total: plannedTotal, pick: (s: (typeof group.sections)[number]) => s.planned }, { label: 'Actual', total: actualTotal, pick: (s: (typeof group.sections)[number]) => s.actual }] as bar (bar.label)}
      <div class="space-y-1.5">
        <div class="flex justify-between text-xs text-muted">
          <span>{bar.label}</span>
          <span class="tnum">{fmt(bar.total)}</span>
        </div>
        <div class="flex h-7 w-full overflow-hidden rounded-control bg-ink/[0.04]">
          {#each group.sections as s (s.id)}
            <div
              class="h-full origin-left first:rounded-l-control last:rounded-r-control"
              style={`width:${seg(bar.pick(s), bar.total)}%;background:${s.color};transition:width var(--dur-slow) var(--ease-out)`}
              title={`${s.name} · ${fmt(bar.pick(s))}`}
            ></div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- Per-section breakdown -->
  <ul class="divide-y divide-hairline">
    {#each group.sections as s (s.id)}
      {@const delta = s.actual - s.planned}
      <li class="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 py-2.5 first:pt-0 last:pb-0">
        <span class="h-2.5 w-2.5 rounded-[3px]" style={`background:${s.color}`}></span>
        <div class="min-w-0">
          <p class="truncate text-sm text-ink">{s.name}</p>
          <p class="text-xs text-muted">
            {#if s.kind === 'remainder'}
              Remainder
            {:else if s.plannedPct != null}
              {formatPercent(s.plannedPct, locale)} of {group.source.toLowerCase()}
            {/if}
          </p>
        </div>
        <div class="text-right">
          <p class="tnum text-sm text-ink">{fmt(s.actual)}</p>
          <p
            class={`tnum text-xs ${delta > 0 ? 'text-expense' : delta < 0 ? 'text-income' : 'text-muted'}`}
          >
            {delta === 0 ? 'on plan' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}
          </p>
        </div>
      </li>
    {/each}
  </ul>
</div>
