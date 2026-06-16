<script lang="ts">
  import { ArrowUpRight, ArrowDownRight, Scales, Wallet } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import CountUp from '$lib/components/ui/CountUp.svelte';
  import Sparkline from '$lib/components/charts/Sparkline.svelte';
  import { formatMoney } from '$lib/utils/currency';
  import { summarize, monthlyNets } from '$lib/aggregations';
  import { transactions } from '$lib/stores/transactions';
  import { config } from '$lib/stores/config';
  import { demoCurrency, demoLocale, summary as demoSummary, netSeries as demoNet } from '$lib/seed/dashboard';

  let { fromStr = '', toStr = '' }: { fromStr?: string; toStr?: string } = $props();

  const txAll = transactions.all;

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const hasData = $derived($txAll.length > 0);

  const fmt = $derived(
    (n: number, signed = false) => formatMoney(n, { currency, locale, signed })
  );

  const agg = $derived.by(() => {
    if (!hasData) return demoSummary;
    return summarize($txAll, fromStr || undefined, toStr || undefined);
  });

  // Sparkline: last 12 monthly cumulative nets
  const sparkValues = $derived.by(() => {
    if (!hasData) return demoNet.map((p) => p.value);
    const monthly = monthlyNets($txAll);
    return monthly.slice(-12).map((m) => m.cumulative);
  });

  const cards = $derived([
    { label: 'Income', value: agg.income, icon: ArrowUpRight, tone: 'text-income', spark: false },
    { label: 'Spending', value: agg.spending, icon: ArrowDownRight, tone: 'text-expense', spark: false },
    { label: 'Net', value: agg.net, icon: Scales, tone: agg.net >= 0 ? 'text-income' : 'text-expense', spark: true, signed: true },
    { label: 'Liquid balance', value: agg.net, icon: Wallet, tone: 'text-ink', spark: true }
  ]);
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
  {#each cards as c (c.label)}
    <Card class="flex h-full flex-col gap-2.5">
      <div class="flex items-center justify-between gap-1.5">
        <span class="truncate whitespace-nowrap text-xs text-muted">{c.label}</span>
        <c.icon class={`h-4 w-4 shrink-0 ${c.tone}`} />
      </div>
      <div class="mt-auto">
        <CountUp
          value={c.value}
          format={(n) => fmt(n, c.signed)}
          class="tnum block whitespace-nowrap text-lg font-medium text-ink md:text-xl"
        />
        {#if c.spark}
          <div class="mt-2.5">
            <Sparkline values={sparkValues} width={140} height={24} />
          </div>
        {/if}
      </div>
    </Card>
  {/each}
</div>
