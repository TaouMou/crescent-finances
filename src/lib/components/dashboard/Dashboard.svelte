<script lang="ts">
  import { Check, Info } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import DateField from '$lib/components/ui/DateField.svelte';
  import SummaryCards from './SummaryCards.svelte';
  import AnomaliesList from './AnomaliesList.svelte';
  import SpendingByCategory from '$lib/components/charts/SpendingByCategory.svelte';
  import NetOverTime from '$lib/components/charts/NetOverTime.svelte';
  import DistributionView from '$lib/components/sections/DistributionView.svelte';
  import TargetProgress from '$lib/components/sections/TargetProgress.svelte';
  import {
    spendingByCategory,
    netSeries,
    anomalies,
    distribution,
    targets,
    demoCurrency,
    demoLocale
  } from '$lib/seed/dashboard';
  import { monthsDaysBetween, formatSpan, isSameDay, toISODate } from '$lib/utils/dates';

  // Timeframe for the net-over-time chart: two date selectors + a span label.
  const today = new Date();
  const aYearAgo = new Date(today);
  aYearAgo.setFullYear(today.getFullYear() - 1);

  let fromStr = $state(toISODate(aYearAgo));
  let toStr = $state(toISODate(today));

  const fromDate = $derived(new Date(`${fromStr}T00:00:00`));
  const toDate = $derived(new Date(`${toStr}T23:59:59`));
  const filteredNet = $derived(
    netSeries.filter((p) => {
      const t = p.t * 1000;
      return t >= fromDate.getTime() && t <= toDate.getTime();
    })
  );
  const spanLabel = $derived.by(() => {
    const { months, days } = monthsDaysBetween(fromDate, toDate);
    const span = formatSpan(months, days);
    return isSameDay(toDate, today) ? `Last ${span}` : span;
  });

  // Distribution status, shown as a colored pill in the card header.
  const planPctSum = distribution.sections.reduce((s, x) => s + (x.plannedPct ?? 0), 0);
  const planBalanced = Math.round(planPctSum) === 100;
</script>

<div class="relative">
  <!-- Ambient accent glow in the top chrome; cards sit on flat surfaces above it. -->
  <div class="bokeh-ambient pointer-events-none absolute inset-x-0 top-0 z-0 h-80"></div>
  <div class="relative z-10 mx-auto max-w-[1180px] space-y-5 p-6">
  <SummaryCards />

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <!-- Main column -->
    <div class="space-y-5 lg:col-span-2">
      <Card>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 class="card-title">Net over time</h2>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <DateField bind:value={fromStr} max={toStr} label="Start date" />
            <span class="text-muted">–</span>
            <DateField bind:value={toStr} min={fromStr} label="End date" />
            <span class="whitespace-nowrap text-xs text-muted">{spanLabel}</span>
          </div>
        </div>
        <NetOverTime data={filteredNet} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="card-title">Spending by category</h2>
          <span class="text-xs text-muted">June 2026</span>
        </div>
        <SpendingByCategory data={spendingByCategory} currency={demoCurrency} locale={demoLocale} />
      </Card>
    </div>

    <!-- Side column -->
    <div class="space-y-5">
      <Card class="ring-accent/20">
        <div class="mb-4 flex items-center justify-between gap-2">
          <h2 class="card-title">{distribution.name}</h2>
          <span
            class={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border px-2.5 py-1 text-xs font-medium ${
              planBalanced
                ? 'border-income/30 bg-income/10 text-income'
                : 'border-warn/30 bg-warn/10 text-warn'
            }`}
          >
            {#if planBalanced}
              <Check class="h-3.5 w-3.5 shrink-0" /> Balanced · 100%
            {:else}
              <Info class="h-3.5 w-3.5 shrink-0" /> {Math.round(planPctSum)}% allocated
            {/if}
          </span>
        </div>
        <DistributionView group={distribution} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card tint="--c-income">
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="card-title">Goals</h2>
          <span class="text-xs text-muted">Targets</span>
        </div>
        <TargetProgress items={targets} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card tint="--c-warn">
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="card-title">Anomalies</h2>
          <span class="text-xs text-muted">This period</span>
        </div>
        <AnomaliesList data={anomalies} />
      </Card>
    </div>
  </div>
  </div>
</div>
