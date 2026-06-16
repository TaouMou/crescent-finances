<script lang="ts">
  import { ArrowUp, ArrowDown } from 'phosphor-svelte';
  import { transactions } from '$lib/stores/transactions';
  import { config } from '$lib/stores/config';
  import { monthlyNets } from '$lib/aggregations';
  import { formatMoney } from '$lib/utils/currency';
  import { cn } from '$lib/utils/cn';
  import { demoCurrency, demoLocale, demoMonthly } from '$lib/seed/dashboard';

  const txAll = transactions.all;
  const txLoading = transactions.loading;

  $effect(() => {
    transactions.loadAll();
  });

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const hasData = $derived($txAll.length > 0);

  const months = $derived.by(() => {
    if (!hasData) return demoMonthly;
    return [...monthlyNets($txAll)].reverse();
  });

  const maxBar = $derived(
    Math.max(...months.map((m) => Math.max(m.income, m.spending)), 1)
  );

  const totals = $derived(
    months.reduce(
      (acc, m) => ({ income: acc.income + m.income, spending: acc.spending + m.spending, net: acc.net + m.net }),
      { income: 0, spending: 0, net: 0 }
    )
  );

  function fmt(n: number, signed = false) {
    return formatMoney(n, { currency, locale, signed });
  }

  function monthLabel(bucket: string) {
    const [y, m] = bucket.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale, {
      month: 'short',
      year: 'numeric'
    });
  }
</script>

<div class="mx-auto max-w-[860px] space-y-6 p-6">
  <!-- Header -->
  <div>
    <h1 class="text-lg font-semibold text-ink">Monthly breakdown</h1>
    <p class="mt-0.5 text-sm text-muted">Income, spending and net per calendar month.</p>
  </div>

  {#if $txLoading}
    <div class="flex h-40 items-center justify-center text-sm text-muted">Decrypting…</div>
  {:else}
    <!-- Summary strip -->
    <div class="card rounded-card grid grid-cols-3 divide-x divide-hairline">
      {#each [
        { label: 'Total income',   value: totals.income,   tone: 'text-income',  signed: false },
        { label: 'Total spending', value: totals.spending, tone: 'text-expense', signed: false },
        { label: 'Net',            value: totals.net,      tone: totals.net >= 0 ? 'text-income' : 'text-expense', signed: true }
      ] as s (s.label)}
        <div class="min-w-0 px-3 py-4 md:px-5">
          <p class="truncate text-xs text-muted">{s.label}</p>
          <p class={cn('tnum mt-2 truncate text-sm font-semibold md:text-lg', s.tone)}>
            {fmt(s.value, s.signed)}
          </p>
        </div>
      {/each}
    </div>

    <!-- Table -->
    <div class="card rounded-card overflow-hidden">
      <!-- Header row -->
      <div class="grid grid-cols-[1fr_auto] gap-3 border-b border-hairline px-4 py-2.5 text-xs font-medium text-muted md:grid-cols-[1fr_110px_110px_110px_80px] md:gap-4 md:px-5">
        <span>Month</span>
        <span class="hidden text-right md:block">Income</span>
        <span class="hidden text-right md:block">Spending</span>
        <span class="text-right">Net</span>
        <span class="hidden md:block"></span>
      </div>

      <!-- Month rows -->
      {#each months as m (m.bucket)}
        {@const isPositive = m.net >= 0}
        {@const incomePct = (m.income / maxBar) * 100}
        {@const spendPct = (m.spending / maxBar) * 100}

        <div class="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-hairline/60 px-4 py-3 last:border-0 hover:bg-ink/[0.02] md:grid-cols-[1fr_110px_110px_110px_80px] md:gap-4 md:px-5">
          <!-- Month label -->
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink">{monthLabel(m.bucket)}</p>
            <!-- Mobile: income · spending as subtitle -->
            <p class="mt-0.5 text-xs text-muted md:hidden">
              <span class="text-income">{fmt(m.income)}</span>
              <span class="mx-1">·</span>
              <span class="text-expense">{fmt(m.spending)}</span>
            </p>
          </div>

          <!-- Income (desktop) -->
          <p class="tnum hidden text-right text-sm text-income md:block">{fmt(m.income)}</p>

          <!-- Spending (desktop) -->
          <p class="tnum hidden text-right text-sm text-expense md:block">{fmt(m.spending)}</p>

          <!-- Net -->
          <div class="flex items-center justify-end gap-1">
            {#if isPositive}
              <ArrowUp class="h-3 w-3 shrink-0 text-income" />
            {:else}
              <ArrowDown class="h-3 w-3 shrink-0 text-expense" />
            {/if}
            <p class={cn('tnum text-right text-sm font-medium', isPositive ? 'text-income' : 'text-expense')}>
              {fmt(Math.abs(m.net))}
            </p>
          </div>

          <!-- Mini bar (desktop) -->
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
