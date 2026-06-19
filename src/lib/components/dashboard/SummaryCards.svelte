<script lang="ts">
  import { ArrowUpRight, ArrowDownRight, Scales, Wallet } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import CountUp from '$lib/components/ui/CountUp.svelte';
  import { formatMoney } from '$lib/utils/currency';
  import { summarize, liquidBalance } from '$lib/aggregations';
  import { transactions } from '$lib/stores/transactions';
  import { balances } from '$lib/stores/balances';
  import { config } from '$lib/stores/config';
  import { demoMode } from '$lib/stores/demo';
  import { demoCurrency, demoLocale, summary as demoSummary } from '$lib/seed/dashboard';

  let {
    fromStr = '',
    toStr = '',
    spanLabel = ''
  }: { fromStr?: string; toStr?: string; spanLabel?: string } = $props();

  const txAll = transactions.all;

  $effect(() => {
    balances.load();
  });

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const hasData = $derived($txAll.length > 0);
  const showDemo = $derived($demoMode && !hasData);

  // Caption tying the period-scoped cards to the active date filter.
  const periodCaption = $derived(spanLabel || 'Selected period');

  // Headline cards drop the cents for a cleaner, more prominent figure that
  // fits the narrow layout without truncating.
  const fmt = $derived(
    (n: number, signed = false) => formatMoney(n, { currency, locale, signed, whole: true })
  );

  const agg = $derived.by(() => {
    if (showDemo) return demoSummary;
    return summarize($txAll, fromStr || undefined, toStr || undefined);
  });

  // Liquid balance is a point-in-time figure: starting-balance anchors + every
  // transaction, independent of the selected date range.
  const liquid = $derived.by(() => {
    if (showDemo) return demoSummary.liquidBalance;
    return liquidBalance($txAll, $balances);
  });

  // Income / Spending / Net all recompute from the selected date range, so they
  // share a quieter treatment and a "selected period" caption. Liquid balance is
  // the point-in-time anchor and gets the hero card below.
  // Full, literal class strings (no interpolation) so Tailwind keeps them.
  const periodCards = $derived([
    { label: 'Income', value: agg.income, icon: ArrowUpRight, chip: 'bg-income/10', accent: 'text-income', valueTone: 'text-income', signed: false },
    { label: 'Spending', value: agg.spending, icon: ArrowDownRight, chip: 'bg-expense/10', accent: 'text-expense', valueTone: 'text-expense', signed: false },
    { label: 'Net', value: agg.net, icon: Scales, chip: agg.net >= 0 ? 'bg-income/10' : 'bg-expense/10', accent: agg.net >= 0 ? 'text-income' : 'text-expense', valueTone: agg.net >= 0 ? 'text-income' : 'text-expense', signed: true }
  ]);
</script>

<div class="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-4">
  <!-- Period-scoped trio: changes with the date filter -->
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:order-1 lg:col-span-3">
    {#each periodCards as c (c.label)}
      <Card class="flex h-full min-w-0 flex-col justify-between gap-3 p-4 sm:p-5">
        <div class="flex items-center justify-between gap-2">
          <span class="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted sm:text-xs">
            {c.label}
          </span>
          <span class={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${c.chip}`}>
            <c.icon class={`h-4 w-4 ${c.accent}`} />
          </span>
        </div>
        <div class="min-w-0 space-y-1.5">
          <CountUp
            value={c.value}
            format={(n) => fmt(n, c.signed)}
            class={`tnum block truncate text-xl font-bold leading-none tracking-tight sm:text-2xl ${c.valueTone}`}
          />
          <span class="block truncate text-[10px] font-medium uppercase tracking-wide text-muted/70">
            {periodCaption}
          </span>
        </div>
      </Card>
    {/each}
  </div>

  <!-- Hero: liquid balance is point-in-time, independent of the filter. Leads on
       mobile (the main focus), sits on the right of the trio from lg up. -->
  <Card class="order-first flex h-full min-w-0 flex-col justify-between gap-3 bg-accent/[0.06] p-4 ring-1 ring-accent/30 sm:p-5 lg:order-2 lg:col-span-1">
    <div class="flex items-center justify-between gap-2">
      <span class="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-accent sm:text-xs">
        Liquid balance
      </span>
      <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15">
        <Wallet class="h-4 w-4 text-accent" />
      </span>
    </div>
    <div class="min-w-0 space-y-1.5">
      <CountUp
        value={liquid}
        format={(n) => fmt(n, false)}
        class="tnum block truncate text-2xl font-bold leading-none tracking-tight text-ink sm:text-3xl lg:text-[2rem]"
      />
      <span class="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
        <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
        Now
      </span>
    </div>
  </Card>
</div>
