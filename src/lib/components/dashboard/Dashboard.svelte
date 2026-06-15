<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
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
</script>

<div class="mx-auto max-w-[1180px] space-y-5 p-6">
  <SummaryCards />

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <!-- Main column -->
    <div class="space-y-5 lg:col-span-2">
      <Card>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 class="text-sm font-medium text-ink">Net over time</h2>
          <div class="flex items-center gap-2">
            <input
              type="date"
              bind:value={fromStr}
              max={toStr}
              aria-label="Start date"
              class="h-8 rounded-control border border-hairline bg-surface px-2 text-xs text-ink [color-scheme:light] focus-visible:outline-none dark:[color-scheme:dark]"
            />
            <span class="text-muted">–</span>
            <input
              type="date"
              bind:value={toStr}
              min={fromStr}
              aria-label="End date"
              class="h-8 rounded-control border border-hairline bg-surface px-2 text-xs text-ink [color-scheme:light] focus-visible:outline-none dark:[color-scheme:dark]"
            />
            <span class="whitespace-nowrap text-xs text-muted">{spanLabel}</span>
          </div>
        </div>
        <NetOverTime data={filteredNet} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">Spending by category</h2>
          <span class="text-xs text-muted">June 2026</span>
        </div>
        <SpendingByCategory data={spendingByCategory} currency={demoCurrency} locale={demoLocale} />
      </Card>
    </div>

    <!-- Side column -->
    <div class="space-y-5">
      <Card class="ring-accent/20">
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">{distribution.name}</h2>
          <span class="text-xs text-muted">Distribution</span>
        </div>
        <DistributionView group={distribution} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">Goals</h2>
          <span class="text-xs text-muted">Targets</span>
        </div>
        <TargetProgress items={targets} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">Anomalies</h2>
          <span class="text-xs text-muted">This period</span>
        </div>
        <AnomaliesList data={anomalies} />
      </Card>
    </div>
  </div>
</div>
