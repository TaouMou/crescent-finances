<script lang="ts">
  import { ArrowUpRight, ArrowDownRight, Scales, Wallet } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Sparkline from '$lib/components/charts/Sparkline.svelte';
  import { formatMoney } from '$lib/utils/currency';
  import { summary, netSeries, demoCurrency, demoLocale } from '$lib/seed/dashboard';

  const fmt = (n: number, signed = false) =>
    formatMoney(n, { currency: demoCurrency, locale: demoLocale, signed });

  const trend = netSeries.map((p) => p.value);

  const cards = [
    { label: 'Income', value: fmt(summary.income), icon: ArrowUpRight, tone: 'text-income', tint: '--c-income' },
    { label: 'Spending', value: fmt(summary.spending), icon: ArrowDownRight, tone: 'text-expense', tint: '--c-expense' },
    { label: 'Net', value: fmt(summary.net, true), icon: Scales, tone: 'text-ink', tint: '--c-accent', spark: true },
    { label: 'Liquid balance', value: fmt(summary.liquidBalance), icon: Wallet, tone: 'text-ink', tint: '--c-accent', spark: true }
  ];
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
  {#each cards as c (c.label)}
    <Card tint={c.tint} class="flex h-full flex-col gap-2.5">
      <div class="flex items-center justify-between gap-1.5">
        <span class="truncate whitespace-nowrap text-xs text-muted">{c.label}</span>
        <c.icon class={`h-4 w-4 shrink-0 ${c.tone}`} />
      </div>
      <div class="mt-auto">
        <span class="tnum block whitespace-nowrap text-lg font-medium text-ink md:text-xl">{c.value}</span>
        {#if c.spark}
          <div class="mt-2.5">
            <Sparkline values={trend} width={140} height={24} />
          </div>
        {/if}
      </div>
    </Card>
  {/each}
</div>
