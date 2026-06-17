<script lang="ts">
  import { formatMoney, formatPercent } from '$lib/utils/currency';
  import type { DistributionGroup, DistributionSection } from '$lib/seed/dashboard';

  let {
    group,
    currency = 'EUR',
    locale = 'en-US'
  }: { group: DistributionGroup; currency?: string; locale?: string } = $props();

  const fmt = (n: number) => formatMoney(n, { currency, locale });

  const plannedTotal = $derived(group.sections.reduce((s, x) => s + x.planned, 0));

  // One shared scale across the rows so every bullet is comparable at a glance.
  const scale = $derived(Math.max(1, ...group.sections.map((s) => Math.max(s.planned, s.actual))));
  const w = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`;

  // Polarity-aware delta: for a spending bucket (lowerIsBetter) over plan is bad;
  // for a savings/investing bucket (higherIsBetter) over plan is good.
  function meta(s: DistributionSection) {
    const delta = s.actual - s.planned; // + = over plan
    const over = delta > 0;
    const higherIsBetter = s.direction === 'higherIsBetter';
    const good = delta === 0 ? null : over === higherIsBetter;
    const label = delta === 0 ? 'on plan' : `${fmt(Math.abs(delta))} ${over ? 'over' : 'under'}`;
    const tone = good === null ? 'text-muted' : good ? 'text-income' : 'text-expense';
    // Overflow segment colour when actual exceeds plan. Tokens are space-separated
    // RGB channels, so they must be wrapped in rgb() to be a valid background.
    const overflow = over ? (good ? 'rgb(var(--c-income))' : 'rgb(var(--c-expense))') : null;
    return { delta, over, good, label, tone, overflow };
  }
</script>

<div class="space-y-5">
  <div class="space-y-1">
    <p class="text-sm text-muted">Source · {group.source}</p>
    <p class="tnum text-xl font-medium text-ink">{fmt(group.total)}</p>
  </div>

  <!-- Planned allocation: how the source splits across sections (the plan). -->
  <div class="space-y-1.5">
    <div class="flex justify-between text-xs text-muted">
      <span>Planned allocation</span>
      <span class="tnum">{fmt(plannedTotal)}</span>
    </div>
    <div class="flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
      {#each group.sections as s (s.id)}
        <div
          class="h-full first:rounded-l-full last:rounded-r-full"
          style={`flex:${Math.max(s.planned, 0)} 0 0;background:${s.color};transition:flex-grow var(--dur-slow) var(--ease-out)`}
          title={`${s.name} · ${fmt(s.planned)}`}
        ></div>
      {/each}
    </div>
  </div>

  <!-- Per-section bullets: actual measured against its planned target. -->
  <ul class="space-y-3.5">
    {#each group.sections as s (s.id)}
      {@const m = meta(s)}
      <li class="space-y-1.5">
        <div class="flex items-baseline justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={`background:${s.color}`}></span>
            <span class="truncate text-sm text-ink">{s.name}</span>
          </div>
          <div class="flex shrink-0 items-baseline gap-2">
            <span class="tnum text-sm text-ink">{fmt(s.actual)}</span>
            <span class={`tnum text-xs ${m.tone}`}>{m.label}</span>
          </div>
        </div>

        <!-- Bullet: track · actual fill (capped at plan) · overflow cap · planned tick -->
        <div class="relative h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
          <div
            class="absolute inset-y-0 left-0 rounded-full"
            style={`width:${w(Math.min(s.actual, s.planned || s.actual))};background:${s.color};transition:width var(--dur-slow) var(--ease-out)`}
          ></div>
          {#if m.overflow}
            <div
              class="absolute inset-y-0"
              style={`left:${w(s.planned)};width:${w(s.actual - s.planned)};background:${m.overflow}`}
            ></div>
          {/if}
          {#if s.planned > 0}
            <div
              class="absolute inset-y-0 w-[2px] bg-ink/45"
              style={`left:${w(s.planned)}`}
              title={`Planned · ${fmt(s.planned)}`}
            ></div>
          {/if}
        </div>

        <p class="text-xs text-muted">
          Plan {fmt(s.planned)}{#if s.kind === 'remainder'}&nbsp;· remainder{:else if s.plannedPct != null}&nbsp;·
            {formatPercent(s.plannedPct, locale)} of {group.source.toLowerCase()}{/if}
        </p>
      </li>
    {/each}
  </ul>
</div>
