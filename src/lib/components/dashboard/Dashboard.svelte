<script lang="ts">
  import { Check, Info, ArrowUpRight } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import DateField from '$lib/components/ui/DateField.svelte';
  import SummaryCards from './SummaryCards.svelte';
  import AnomaliesList from './AnomaliesList.svelte';
  import SpendingByCategory from '$lib/components/charts/SpendingByCategory.svelte';
  import NetOverTime from '$lib/components/charts/NetOverTime.svelte';
  import DistributionView from '$lib/components/sections/DistributionView.svelte';
  import TargetProgress from '$lib/components/sections/TargetProgress.svelte';
  import {
    anomalies,
    distribution as demoDistribution,
    targets as demoTargets,
    spendingByCategory as demoSpending,
    netSeries as demoNetSeries,
    demoCurrency,
    demoLocale
  } from '$lib/seed/dashboard';
  import { monthsDaysBetween, formatSpan, isSameDay, toISODate } from '$lib/utils/dates';
  import { transactions } from '$lib/stores/transactions';
  import { config } from '$lib/stores/config';
  import { demoMode } from '$lib/stores/demo';
  import { categoryBreakdown, dailyCumulative } from '$lib/aggregations';
  import { evaluatePlan } from '$lib/sections/engine';
  import { detectAnomalies } from '$lib/anomaly/engine';

  // ----- data -----
  const txAll = transactions.all;
  const txCount = transactions;
  const txLoading = transactions.loading;

  $effect(() => {
    transactions.loadAll();
  });

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const categories = $derived($config?.categories ?? []);
  const hasData = $derived($txCount > 0);
  // Seed data is illustrative only: show it while the demo toggle is on AND
  // there's no real data yet. All panels honour this single flag, so the
  // dashboard is either fully demo or fully real — never a confusing mix.
  const showDemo = $derived($demoMode && !hasData);

  // ----- net-over-time chart -----
  const today = new Date();
  const aYearAgo = new Date(today);
  aYearAgo.setFullYear(today.getFullYear() - 1);

  let fromStr = $state(toISODate(aYearAgo));
  let toStr = $state(toISODate(today));

  const fromDate = $derived(new Date(`${fromStr}T00:00:00`));
  const toDate = $derived(new Date(`${toStr}T23:59:59`));

  // Epoch-second bounds (UTC, matching the chart's point timestamps) so the
  // Net-over-time chart always spans exactly the picked window — not just the
  // extent of the available data points.
  const xMin = $derived(Math.floor(new Date(`${fromStr}T00:00:00Z`).getTime() / 1000));
  const xMax = $derived(Math.floor(new Date(`${toStr}T23:59:59Z`).getTime() / 1000));

  const spanLabel = $derived.by(() => {
    const { months, days } = monthsDaysBetween(fromDate, toDate);
    const span = formatSpan(months, days);
    return isSameDay(toDate, today) ? `Last ${span}` : span;
  });

  // Daily cumulative net series (epoch-seconds + value) for uPlot
  const netSeries = $derived.by(() =>
    showDemo ? demoNetSeries : dailyCumulative($txAll, fromStr, toStr)
  );

  // Spending by category for current period
  const catSpend = $derived.by(() => {
    if (showDemo) return demoSpending;
    const breakdown = categoryBreakdown($txAll, categories, fromStr, toStr);
    return breakdown.map((b) => ({ name: b.name, color: b.color, amount: b.amount }));
  });

  // Real plan from config when the user has configured sections.
  const realPlan = $derived(
    evaluatePlan($config?.sectionGroups ?? [], $config?.sections ?? [], $txAll, $config?.assetPools ?? [])
  );
  const realDist = $derived(realPlan.find((g) => g.distribution.sections.length > 0)?.distribution);
  const realTargets = $derived(realPlan.flatMap((g) => g.targets));

  // Real config wins when present; demo seed only fills in while showDemo.
  const distribution = $derived(realDist ?? (showDemo ? demoDistribution : undefined));
  const targets = $derived(realTargets.length > 0 ? realTargets : showDemo ? demoTargets : []);

  // Distribution status badge
  const planPctSum = $derived(distribution?.sections.reduce((s, x) => s + (x.plannedPct ?? 0), 0) ?? 0);
  const planBalanced = $derived(Math.round(planPctSum) === 100);

  // Real anomalies from saved thresholds; demo seed only while showDemo.
  const anomalySettings = $derived(
    $config?.settings?.anomaly ?? { baselineMonths: 6, thresholdPct: 40, minAbsolute: 5000, madK: 3 }
  );
  const realAnomalies = $derived(detectAnomalies($txAll, categories, anomalySettings));
  const anomalyData = $derived(showDemo ? anomalies : realAnomalies);
</script>

<div class="mx-auto max-w-[1180px] space-y-5 p-6">
  <SummaryCards {fromStr} {toStr} />

  {#if !hasData && !$txLoading}
    <!-- Empty state CTA -->
    <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent/5 py-12 text-center">
      {#if showDemo}
        <p class="text-base font-medium text-ink">Showing sample data</p>
        <p class="text-sm text-muted">These are illustrative figures. Import a CSV to replace them with your own, or turn off demo data in Settings.</p>
      {:else}
        <p class="text-base font-medium text-ink">No transactions imported yet</p>
        <p class="text-sm text-muted">Import a CSV bank export to see real data here.</p>
      {/if}
      <a
        href="#import"
        class="press mt-2 flex h-9 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80"
      >
        <ArrowUpRight class="h-4 w-4" /> Import CSV
      </a>
    </div>
  {/if}

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
        {#if netSeries.length === 0}
          <div class="flex h-32 items-center justify-center text-sm text-muted">
            {$txLoading ? 'Loading…' : 'No data for this period'}
          </div>
        {:else}
          <NetOverTime data={netSeries} {currency} {locale} {xMin} {xMax} />
        {/if}
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="card-title">Spending by category</h2>
          <span class="whitespace-nowrap text-xs text-muted">{fromStr.slice(0, 7)} – {toStr.slice(0, 7)}</span>
        </div>
        {#if catSpend.length === 0}
          <div class="flex h-24 items-center justify-center text-sm text-muted">
            {$txLoading ? 'Loading…' : 'No categorized spending'}
          </div>
        {:else}
          <SpendingByCategory data={catSpend} {currency} {locale} />
        {/if}
      </Card>
    </div>

    <!-- Side column -->
    <div class="space-y-5">
      <Card class="ring-accent/20">
        <div class="mb-4 flex items-center justify-between gap-2">
          <h2 class="card-title">{distribution?.name ?? 'Monthly plan'}</h2>
          {#if distribution}
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
          {/if}
        </div>
        {#if distribution}
          <DistributionView group={distribution} {currency} {locale} />
        {:else}
          <div class="flex flex-col items-center gap-1.5 py-8 text-center">
            <p class="text-sm text-muted">No plan configured.</p>
            <a href="#plan" class="text-sm font-medium text-accent hover:underline">Set up your plan</a>
          </div>
        {/if}
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="card-title">Goals</h2>
          <span class="text-xs text-muted">Targets</span>
        </div>
        {#if targets.length > 0}
          <TargetProgress items={targets} {currency} {locale} />
        {:else}
          <div class="flex flex-col items-center gap-1.5 py-8 text-center">
            <p class="text-sm text-muted">No goals yet.</p>
            <a href="#plan" class="text-sm font-medium text-accent hover:underline">Add a target</a>
          </div>
        {/if}
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="card-title">Anomalies</h2>
          <span class="text-xs text-muted">This period</span>
        </div>
        <AnomaliesList data={anomalyData} />
      </Card>
    </div>
  </div>
</div>
