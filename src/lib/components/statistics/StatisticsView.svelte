<script lang="ts">
  import { ArrowUp, ArrowDown } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import SpendingByCategory from '$lib/components/charts/SpendingByCategory.svelte';
  import IncomeVsSpending from '$lib/components/charts/IncomeVsSpending.svelte';
  import SavingsRate from '$lib/components/charts/SavingsRate.svelte';
  import DateRangeControl from '$lib/components/ui/DateRangeControl.svelte';
  import { spendingByCategory as demoSpending, demoMonthly, demoCurrency, demoLocale } from '$lib/seed/dashboard';
  import { toISODate, formatMonthLabel } from '$lib/utils/dates';
  import { transactions } from '$lib/stores/transactions';
  import { config } from '$lib/stores/config';
  import { demoMode } from '$lib/stores/demo';
  import { categoryBreakdown, monthlyNets } from '$lib/aggregations';
  import { formatMoney } from '$lib/utils/currency';
  import { cn } from '$lib/utils/cn';

  const txAll = transactions.all;
  const txCount = transactions;
  const txLoading = transactions.loading;

  $effect(() => {
    transactions.loadAll();
  });

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

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const categories = $derived($config?.categories ?? []);
  const hasData = $derived($txCount > 0);
  const showDemo = $derived($demoMode && !hasData);

  // Monthly buckets within the selected range (oldest first for charts).
  const monthlyData = $derived.by(() => {
    const from = fromStr.slice(0, 7);
    const to = toStr.slice(0, 7);
    const source = showDemo ? demoMonthly : monthlyNets($txAll);
    return source.filter((m) => m.bucket >= from && m.bucket <= to);
  });
  // Table reads latest first.
  const monthsDesc = $derived([...monthlyData].sort((a, b) => b.bucket.localeCompare(a.bucket)));

  const avgSavingsRate = $derived.by(() => {
    const months = monthlyData.filter((m) => m.income > 0);
    if (months.length === 0) return null;
    return Math.round((months.reduce((s, m) => s + m.net / m.income, 0) / months.length) * 100);
  });

  const catSpend = $derived.by(() => {
    if (showDemo) return demoSpending;
    return categoryBreakdown($txAll, categories, fromStr, toStr).map((b) => ({
      name: b.name,
      color: b.color,
      amount: b.amount
    }));
  });

  const totals = $derived(
    monthlyData.reduce(
      (acc, m) => ({ income: acc.income + m.income, spending: acc.spending + m.spending, net: acc.net + m.net }),
      { income: 0, spending: 0, net: 0 }
    )
  );

  const maxBar = $derived(Math.max(...monthlyData.map((m) => Math.max(m.income, m.spending)), 1));

  const fmt = (n: number, signed = false) => formatMoney(n, { currency, locale, signed });
  const fmtWhole = (n: number, signed = false) => formatMoney(n, { currency, locale, signed, whole: true });
</script>

<div class="mx-auto max-w-[1180px] space-y-5 p-6">
  <!-- Inline date range (desktop); mobile reaches it via the right drawer -->
  <div class="flex items-center justify-between gap-3">
    <div>
      <h1 class="text-lg font-semibold text-ink">Statistics</h1>
      <p class="mt-0.5 text-sm text-muted">Trends across the selected range.</p>
    </div>
    <div class="hidden lg:block">
      <DateRangeControl bind:fromStr bind:toStr {spanLabel} />
    </div>
  </div>

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <Card class="lg:col-span-2">
      <div class="mb-4 flex items-center gap-4">
        <h2 class="card-title">Income vs Spending</h2>
        <div class="flex items-center gap-3 text-xs text-muted">
          <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-[3px] bg-income"></span>Income</span>
          <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-[3px] bg-expense"></span>Spending</span>
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
    </Card>
  </div>

  <!-- Monthly breakdown table -->
  {#if monthlyData.length > 0}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {#each [
        { label: 'Total income',   value: totals.income,   tone: 'text-income',  signed: false },
        { label: 'Total spending', value: totals.spending, tone: 'text-expense', signed: false },
        { label: 'Net',            value: totals.net,      tone: totals.net >= 0 ? 'text-income' : 'text-expense', signed: true }
      ] as s (s.label)}
        <div class="card rounded-card min-w-0 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</p>
          <p class={cn('tnum mt-2 truncate text-xl font-bold leading-none md:text-2xl', s.tone)}>{fmtWhole(s.value, s.signed)}</p>
        </div>
      {/each}
    </div>

    <div class="card rounded-card overflow-hidden">
      <div class="grid grid-cols-[1fr_auto] gap-3 border-b border-hairline px-4 py-2.5 text-xs font-medium text-muted md:grid-cols-[1fr_110px_110px_110px_80px] md:gap-4 md:px-5">
        <span>Month</span>
        <span class="hidden text-right md:block">Income</span>
        <span class="hidden text-right md:block">Spending</span>
        <span class="text-right">Net</span>
        <span class="hidden md:block"></span>
      </div>

      {#each monthsDesc as m (m.bucket)}
        {@const isPositive = m.net >= 0}
        {@const incomePct = (m.income / maxBar) * 100}
        {@const spendPct = (m.spending / maxBar) * 100}
        <div class="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-hairline/60 px-4 py-3 last:border-0 hover:bg-ink/[0.02] md:grid-cols-[1fr_110px_110px_110px_80px] md:gap-4 md:px-5">
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink">{formatMonthLabel(m.bucket, locale)}</p>
            <p class="mt-0.5 text-xs text-muted md:hidden">
              <span class="text-income">{fmt(m.income)}</span>
              <span class="mx-1">·</span>
              <span class="text-expense">{fmt(m.spending)}</span>
            </p>
          </div>
          <p class="tnum hidden text-right text-sm text-income md:block">{fmt(m.income)}</p>
          <p class="tnum hidden text-right text-sm text-expense md:block">{fmt(m.spending)}</p>
          <div class="flex items-center justify-end gap-1">
            {#if isPositive}
              <ArrowUp class="h-3 w-3 shrink-0 text-income" />
            {:else}
              <ArrowDown class="h-3 w-3 shrink-0 text-expense" />
            {/if}
            <p class={cn('tnum text-right text-sm font-medium', isPositive ? 'text-income' : 'text-expense')}>{fmt(Math.abs(m.net))}</p>
          </div>
          <div class="hidden h-5 flex-col justify-center gap-0.5 md:flex">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
              <div class="h-full rounded-full bg-income/70" style="width: {incomePct}%"></div>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
              <div class="h-full rounded-full bg-expense/70" style="width: {spendPct}%"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
