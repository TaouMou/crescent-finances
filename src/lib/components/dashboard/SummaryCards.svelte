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

  let { fromStr = '', toStr = '' }: { fromStr?: string; toStr?: string } = $props();

  const txAll = transactions.all;

  $effect(() => {
    balances.load();
  });

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const hasData = $derived($txAll.length > 0);
  const showDemo = $derived($demoMode && !hasData);

  // Headline cards drop the cents for a cleaner, more prominent figure that
  // fits the narrow 2-up mobile layout without truncating.
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

  // Full, literal class strings (no interpolation) so Tailwind keeps them.
  const cards = $derived([
    { label: 'Income', value: agg.income, icon: ArrowUpRight, chip: 'bg-income/10', accent: 'text-income', valueTone: 'text-income', signed: false },
    { label: 'Spending', value: agg.spending, icon: ArrowDownRight, chip: 'bg-expense/10', accent: 'text-expense', valueTone: 'text-expense', signed: false },
    { label: 'Net', value: agg.net, icon: Scales, chip: agg.net >= 0 ? 'bg-income/10' : 'bg-expense/10', accent: agg.net >= 0 ? 'text-income' : 'text-expense', valueTone: agg.net >= 0 ? 'text-income' : 'text-expense', signed: true },
    { label: 'Liquid balance', value: liquid, icon: Wallet, chip: 'bg-accent/10', accent: 'text-accent', valueTone: 'text-ink', signed: false }
  ]);
</script>

<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
  {#each cards as c (c.label)}
    <Card class="flex h-full min-w-0 flex-col justify-between gap-4 p-4 sm:p-5">
      <div class="flex items-center justify-between gap-2">
        <span class="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted sm:text-xs">
          {c.label}
        </span>
        <span class={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${c.chip}`}>
          <c.icon class={`h-4 w-4 ${c.accent}`} />
        </span>
      </div>
      <CountUp
        value={c.value}
        format={(n) => fmt(n, c.signed)}
        class={`tnum block truncate text-xl font-bold leading-none tracking-tight sm:text-2xl lg:text-[1.7rem] ${c.valueTone}`}
      />
    </Card>
  {/each}
</div>
