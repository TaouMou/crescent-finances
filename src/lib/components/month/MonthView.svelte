<script lang="ts">
  import { ArrowUpRight, Compass, CaretLeft, CaretRight } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import SummaryCards from '$lib/components/dashboard/SummaryCards.svelte';
  import AnomaliesList from '$lib/components/dashboard/AnomaliesList.svelte';
  import SpendingByCategory from '$lib/components/charts/SpendingByCategory.svelte';
  import DistributionView from '$lib/components/sections/DistributionView.svelte';
  import TargetProgress from '$lib/components/sections/TargetProgress.svelte';
  import {
    anomalies,
    distribution as demoDistribution,
    targets as demoTargets,
    spendingByCategory as demoSpending,
    summary as demoSummary,
    demoCurrency,
    demoLocale
  } from '$lib/seed/dashboard';
  import { currentMonth, monthBounds, shiftMonth, formatMonthLabel } from '$lib/utils/dates';
  import { formatMoney } from '$lib/utils/currency';
  import { transactions } from '$lib/stores/transactions';
  import { balances } from '$lib/stores/balances';
  import { config } from '$lib/stores/config';
  import { demoMode } from '$lib/stores/demo';
  import { summarize, categoryBreakdown } from '$lib/aggregations';
  import { evaluatePlan } from '$lib/sections/engine';
  import { detectAnomalies } from '$lib/anomaly/engine';
  import { cn } from '$lib/utils/cn';

  // ----- data -----
  const txAll = transactions.all;
  const txCount = transactions;
  const txLoading = transactions.loading;

  $effect(() => {
    transactions.loadAll();
    balances.load();
  });

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const categories = $derived($config?.categories ?? []);
  const hasData = $derived($txCount > 0);
  // Seed data is illustrative only: show it while the demo toggle is on AND
  // there's no real data yet — never a mix.
  const showDemo = $derived($demoMode && !hasData);

  // ----- month selection -----
  let selectedMonth = $state(currentMonth());
  const bounds = $derived(monthBounds(selectedMonth));
  // No future months to inspect — cap forward navigation at the current month.
  const atCurrentMonth = $derived(selectedMonth >= currentMonth());
  const monthName = $derived(formatMonthLabel(selectedMonth, locale));

  function prevMonth() {
    selectedMonth = shiftMonth(selectedMonth, -1);
  }
  function nextMonth() {
    if (!atCurrentMonth) selectedMonth = shiftMonth(selectedMonth, 1);
  }

  // Income / spending / net for the selected month.
  const monthStats = $derived(showDemo ? demoSummary : summarize($txAll, bounds.from, bounds.to));

  // Spending by category for the selected month.
  const catSpend = $derived.by(() => {
    if (showDemo) return demoSpending;
    return categoryBreakdown($txAll, categories, bounds.from, bounds.to).map((b) => ({
      name: b.name,
      color: b.color,
      amount: b.amount
    }));
  });

  // Plan scoped to the selected month: income, percentages and tracked actuals
  // all reflect that month. Goals stay cumulative inside the engine.
  const realPlan = $derived(
    showDemo
      ? []
      : evaluatePlan(
          $config?.sectionGroups ?? [],
          $config?.sections ?? [],
          $txAll,
          $config?.assetPools ?? [],
          bounds.from,
          bounds.to
        )
  );
  const realDist = $derived(realPlan.find((g) => g.distribution.sections.length > 0)?.distribution);
  const realTargets = $derived(realPlan.flatMap((g) => g.targets));
  const distribution = $derived(realDist ?? (showDemo ? demoDistribution : undefined));
  const targets = $derived(realTargets.length > 0 ? realTargets : showDemo ? demoTargets : []);

  // Anomalies for the selected month (not just the latest one).
  const anomalySettings = $derived(
    $config?.settings?.anomaly ?? { baselineMonths: 6, thresholdPct: 40, minAbsolute: 5000, madK: 3 }
  );
  const anomalyData = $derived(
    showDemo ? anomalies : detectAnomalies($txAll, categories, anomalySettings, selectedMonth)
  );

  const fmtWhole = (n: number, signed = false) => formatMoney(n, { currency, locale, signed, whole: true });
</script>

<div class="mx-auto max-w-[1180px] space-y-5 p-6">
  <SummaryCards />

  <!-- Month picker -->
  <div class="flex items-center justify-between gap-3">
    <div>
      <h2 class="text-sm font-medium text-muted">This month</h2>
      <p class="text-lg font-semibold text-ink">{monthName}</p>
    </div>
    <div class="flex items-center gap-1">
      <button
        class="press grid h-9 w-9 place-items-center rounded-control border border-hairline text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        onclick={prevMonth}
        aria-label="Previous month"
      >
        <CaretLeft class="h-4 w-4" />
      </button>
      <button
        class="press grid h-9 w-9 place-items-center rounded-control border border-hairline text-muted enabled:hover:bg-ink/5 enabled:hover:text-ink enabled:active:bg-ink/10 disabled:opacity-40"
        onclick={nextMonth}
        disabled={atCurrentMonth}
        aria-label="Next month"
      >
        <CaretRight class="h-4 w-4" />
      </button>
    </div>
  </div>

  {#if !hasData && !$txLoading}
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-control border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm">
      <span class="font-medium text-ink">{showDemo ? 'Showing sample data' : 'No transactions yet'}</span>
      <span class="text-muted">{showDemo ? 'Illustrative figures — import your own CSV to replace them.' : 'Import a CSV bank export to see your real numbers.'}</span>
      <div class="ml-auto flex items-center gap-3">
        <a href="#import" class="flex items-center gap-1 font-medium text-accent hover:text-accent/80">
          <ArrowUpRight class="h-3.5 w-3.5" /> Import CSV
        </a>
        <a href="#start" class="flex items-center gap-1 text-muted hover:text-ink">
          <Compass class="h-3.5 w-3.5" /> Start guide
        </a>
      </div>
    </div>
  {/if}

  <!-- This month's income / spending / net -->
  <div class="grid grid-cols-3 gap-4">
    {#each [
      { label: 'Income',   value: monthStats.income,   tone: 'text-income',  signed: false },
      { label: 'Spending', value: monthStats.spending, tone: 'text-expense', signed: false },
      { label: 'Net',      value: monthStats.net,      tone: monthStats.net >= 0 ? 'text-income' : 'text-expense', signed: true }
    ] as s (s.label)}
      <div class="card rounded-card min-w-0 px-4 py-4 md:px-5">
        <p class="truncate text-xs text-muted">{s.label}</p>
        <p class={cn('tnum mt-2 truncate text-base font-semibold md:text-xl', s.tone)}>{fmtWhole(s.value, s.signed)}</p>
      </div>
    {/each}
  </div>

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <!-- Main column -->
    <div class="space-y-5 lg:col-span-2">
      <Card>
        <h2 class="card-title mb-4">Spending by category</h2>
        {#if catSpend.length === 0}
          <div class="flex h-24 items-center justify-center text-sm text-muted">
            {$txLoading ? 'Loading…' : 'No categorized spending this month'}
          </div>
        {:else}
          <SpendingByCategory data={catSpend} {currency} {locale} />
        {/if}
      </Card>

      <Card>
        <div class="mb-1 flex items-baseline justify-between">
          <h2 class="card-title">Anomalies</h2>
          <span class="text-xs text-muted">{monthName}</span>
        </div>
        <p class="mb-4 text-xs text-muted">
          Categories spending unusually more than your last {anomalySettings.baselineMonths} months. Open the
          help panel for how this is measured.
        </p>
        <AnomaliesList data={anomalyData} />
      </Card>
    </div>

    <!-- Side column -->
    <div class="space-y-5">
      <Card class="ring-accent/20">
        <div class="mb-4 flex items-baseline justify-between gap-2">
          <h2 class="card-title">{distribution?.name ?? 'Monthly plan'}</h2>
          <a href="#plan" class="shrink-0 text-xs font-medium text-accent hover:underline">Edit plan</a>
        </div>
        {#if distribution}
          <DistributionView group={distribution} {currency} {locale} periodLabel={showDemo ? undefined : monthName} />
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
    </div>
  </div>
</div>
