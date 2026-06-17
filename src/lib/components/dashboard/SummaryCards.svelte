<script lang="ts">
  import { ArrowUpRight, ArrowDownRight, Scales, Wallet } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import CountUp from '$lib/components/ui/CountUp.svelte';
  import { formatMoney } from '$lib/utils/currency';
  import { summarize } from '$lib/aggregations';
  import { transactions } from '$lib/stores/transactions';
  import { config } from '$lib/stores/config';
  import { demoMode } from '$lib/stores/demo';
  import { demoCurrency, demoLocale, summary as demoSummary } from '$lib/seed/dashboard';

  let { fromStr = '', toStr = '' }: { fromStr?: string; toStr?: string } = $props();

  const txAll = transactions.all;

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const hasData = $derived($txAll.length > 0);
  const showDemo = $derived($demoMode && !hasData);

  const fmt = $derived(
    (n: number, signed = false) => formatMoney(n, { currency, locale, signed })
  );

  const agg = $derived.by(() => {
    if (showDemo) return demoSummary;
    return summarize($txAll, fromStr || undefined, toStr || undefined);
  });

  const cards = $derived([
    { label: 'Income', value: agg.income, icon: ArrowUpRight, tone: 'text-income', signed: false },
    { label: 'Spending', value: agg.spending, icon: ArrowDownRight, tone: 'text-expense', signed: false },
    { label: 'Net', value: agg.net, icon: Scales, tone: agg.net >= 0 ? 'text-income' : 'text-expense', signed: true },
    { label: 'Liquid balance', value: agg.net, icon: Wallet, tone: 'text-ink', signed: false }
  ]);
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
  {#each cards as c (c.label)}
    <Card class="flex h-full flex-col gap-2.5">
      <div class="flex items-center justify-between gap-1.5">
        <span class="truncate whitespace-nowrap text-xs text-muted">{c.label}</span>
        <c.icon class={`h-4 w-4 shrink-0 ${c.tone}`} />
      </div>
      <CountUp
        value={c.value}
        format={(n) => fmt(n, c.signed)}
        class="tnum mt-auto block truncate text-base font-semibold text-ink"
      />
    </Card>
  {/each}
</div>
