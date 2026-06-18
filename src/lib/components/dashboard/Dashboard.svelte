<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Info } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import SummaryCards from './SummaryCards.svelte';
  import SetupChecklist from './SetupChecklist.svelte';
  import AnomaliesList from './AnomaliesList.svelte';
  import SpendingByCategory from '$lib/components/charts/SpendingByCategory.svelte';
  import IncomeVsSpending from '$lib/components/charts/IncomeVsSpending.svelte';
  import SavingsRate from '$lib/components/charts/SavingsRate.svelte';
  import DistributionView from '$lib/components/sections/DistributionView.svelte';
  import TargetProgress from '$lib/components/sections/TargetProgress.svelte';
  import {
    anomalies,
    distribution as demoDistribution,
    targets as demoTargets,
    spendingByCategory as demoSpending,
    demoMonthly,
    demoCurrency,
    demoLocale
  } from '$lib/seed/dashboard';
  import { toISODate } from '$lib/utils/dates';
  import { transactions } from '$lib/stores/transactions';
  import { balances } from '$lib/stores/balances';
  import { config } from '$lib/stores/config';
  import { demoMode } from '$lib/stores/demo';
  import { categoryBreakdown, monthlyNets } from '$lib/aggregations';
  import { evaluatePlan } from '$lib/sections/engine';
  import { detectAnomalies } from '$lib/anomaly/engine';

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
  // there's no real data yet. All panels honour this single flag, so the
  // dashboard is either fully demo or fully real — never a confusing mix.
  const showDemo = $derived($demoMode && !hasData);

  // ----- setup checklist (onboarding) -----
  const SETUP_DISMISSED_KEY = 'crescent.setupDismissed';
  let dismissed = $state(false);
  onMount(() => {
    try {
      dismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === '1';
    } catch {
      /* storage disabled — show by default */
    }
  });
  function dismissSetup() {
    dismissed = true;
    try {
      localStorage.setItem(SETUP_DISMISSED_KEY, '1');
    } catch {
      /* best-effort */
    }
  }

  const hasBalance = $derived(Object.keys($balances).length > 0);
  const hasPlan = $derived(
    ($config?.sectionGroups?.length ?? 0) > 0 && ($config?.sections?.length ?? 0) > 0
  );
  const hasGoal = $derived(($config?.sections ?? []).some((s) => s.calc?.type === 'target'));

  const setupSteps = $derived([
    { key: 'import', label: 'Import your transactions', hint: 'Bring in a CSV bank export.', href: '#import', done: hasData },
    { key: 'balance', label: 'Set your starting balance', hint: 'So Liquid balance shows the real money in your accounts.', href: '#settings', done: hasBalance },
    { key: 'plan', label: 'Set up a monthly plan', hint: 'Split your income into sections.', href: '#plan', done: hasPlan },
    { key: 'goal', label: 'Add a savings goal', hint: 'Track progress toward a target.', href: '#plan', done: hasGoal }
  ]);
  const setupComplete = $derived(setupSteps.every((s) => s.done));
  const showSetup = $derived(!setupComplete && !dismissed && !$txLoading);

  // ----- chart date range (lifted to App.svelte, received as bindable props) -----
  const _today = new Date();
  const _aYearAgo = new Date(_today);
  _aYearAgo.setFullYear(_today.getFullYear() - 1);

  let {
    fromStr = $bindable(toISODate(_aYearAgo)),
    toStr = $bindable(toISODate(_today)),
    spanLabel = ''
  }: {
    fromStr?: string;
    toStr?: string;
    spanLabel?: string;
  } = $props();

  // Monthly buckets for income/spending bars and savings-rate line
  const monthlyData = $derived.by(() => {
    const from = fromStr.slice(0, 7);
    const to = toStr.slice(0, 7);
    if (showDemo) return demoMonthly.filter((m) => m.bucket >= from && m.bucket <= to);
    return monthlyNets($txAll).filter((m) => m.bucket >= from && m.bucket <= to);
  });

  const avgSavingsRate = $derived.by(() => {
    const months = monthlyData.filter((m) => m.income > 0);
    if (months.length === 0) return null;
    return Math.round((months.reduce((s, m) => s + m.net / m.income, 0) / months.length) * 100);
  });

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

  {#if showSetup}
    <SetupChecklist steps={setupSteps} {showDemo} ondismiss={dismissSetup} />
  {/if}

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <!-- Main column -->
    <div class="space-y-5 lg:col-span-2">
      <Card>
        <div class="mb-4 flex items-center gap-4">
          <h2 class="card-title">Income vs Spending</h2>
          <div class="flex items-center gap-3 text-xs text-muted">
            <span class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-[3px] bg-income"></span>Income
            </span>
            <span class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-[3px] bg-expense"></span>Spending
            </span>
          </div>
        </div>
        {#if monthlyData.length === 0}
          <div class="flex h-32 items-center justify-center text-sm text-muted">
            {$txLoading ? 'Loading…' : 'No data for this period'}
          </div>
        {:else}
          <IncomeVsSpending data={monthlyData} {currency} {locale} />
        {/if}
        {#if spanLabel}
          <div class="mt-4 flex items-center gap-2 border-t border-hairline pt-2.5">
            <span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50"></span>
            <span class="text-[11px] text-muted/70">{spanLabel}</span>
          </div>
        {/if}
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="card-title">Savings rate</h2>
          {#if avgSavingsRate !== null}
            <span class={`text-sm font-medium tabular-nums ${avgSavingsRate >= 0 ? 'text-income' : 'text-expense'}`}>
              avg {avgSavingsRate}%
            </span>
          {/if}
        </div>
        {#if monthlyData.length === 0}
          <div class="flex h-24 items-center justify-center text-sm text-muted">
            {$txLoading ? 'Loading…' : 'No data for this period'}
          </div>
        {:else}
          <SavingsRate data={monthlyData} />
        {/if}
        {#if spanLabel}
          <div class="mt-4 flex items-center gap-2 border-t border-hairline pt-2.5">
            <span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50"></span>
            <span class="text-[11px] text-muted/70">{spanLabel}</span>
          </div>
        {/if}
      </Card>

      <Card>
        <h2 class="card-title mb-4">Spending by category</h2>
        {#if catSpend.length === 0}
          <div class="flex h-24 items-center justify-center text-sm text-muted">
            {$txLoading ? 'Loading…' : 'No categorized spending'}
          </div>
        {:else}
          <SpendingByCategory data={catSpend} {currency} {locale} />
        {/if}
        {#if spanLabel}
          <div class="mt-4 flex items-center gap-2 border-t border-hairline pt-2.5">
            <span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50"></span>
            <span class="text-[11px] text-muted/70">{spanLabel}</span>
          </div>
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
