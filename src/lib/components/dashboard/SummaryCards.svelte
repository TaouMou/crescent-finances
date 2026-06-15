<script lang="ts">
  import { ArrowUpRight, ArrowDownRight, Scale, Wallet } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Sparkline from '$lib/components/charts/Sparkline.svelte';
  import { formatMoney } from '$lib/utils/currency';
  import { summary, netSeries, demoCurrency, demoLocale } from '$lib/seed/dashboard';

  const fmt = (n: number, signed = false) =>
    formatMoney(n, { currency: demoCurrency, locale: demoLocale, signed });

  const trend = netSeries.map((p) => p.value);

  const cards = [
    { label: 'Income', value: fmt(summary.income), icon: ArrowUpRight, tone: 'text-income' },
    { label: 'Spending', value: fmt(summary.spending), icon: ArrowDownRight, tone: 'text-expense' },
    { label: 'Net', value: fmt(summary.net, true), icon: Scale, tone: 'text-ink', spark: true },
    { label: 'Liquid balance', value: fmt(summary.liquidBalance), icon: Wallet, tone: 'text-ink', spark: true }
  ];
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
  {#each cards as c (c.label)}
    <Card class="flex flex-col gap-2.5">
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted">{c.label}</span>
        <c.icon class={`h-4 w-4 ${c.tone}`} strokeWidth={1.75} />
      </div>
      <span class="tnum whitespace-nowrap text-lg font-medium text-ink md:text-xl">{c.value}</span>
      {#if c.spark}
        <Sparkline values={trend} width={140} height={24} />
      {/if}
    </Card>
  {/each}
</div>
