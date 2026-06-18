<script lang="ts">
  import { onMount } from 'svelte';
  import { formatMoneyCompact } from '$lib/utils/currency';
  import type { MonthlyNet } from '$lib/aggregations';

  let {
    data,
    currency = 'EUR',
    locale = 'en-US',
    height = 220
  }: { data: MonthlyNet[]; currency?: string; locale?: string; height?: number } = $props();

  let container: HTMLDivElement;
  let width = $state(0);

  const PAD = { top: 12, right: 8, bottom: 30, left: 60 };

  const maxVal = $derived(Math.max(...data.flatMap((d) => [d.income, d.spending]), 1));
  const plotW = $derived(width - PAD.left - PAD.right);
  const plotH = $derived(height - PAD.top - PAD.bottom);
  const n = $derived(data.length);

  const groupW = $derived(n > 0 ? plotW / n : 0);
  // Cap bar width at 50px so wide groups (few months) don't look awkward
  const barW = $derived(Math.min(50, Math.max(3, (groupW * 0.72) / 2)));
  const innerGap = $derived(groupW * 0.06);
  const groupInset = $derived((groupW - barW * 2 - innerGap) / 2);

  function ix(i: number): number {
    return PAD.left + i * groupW + groupInset;
  }

  function sx(i: number): number {
    return ix(i) + barW + innerGap;
  }

  function toY(val: number): number {
    return PAD.top + plotH * (1 - val / maxVal);
  }

  function bh(val: number): number {
    return (val / maxVal) * plotH;
  }

  function niceStep(max: number): number {
    if (max === 0) return 100;
    const rough = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    for (const f of [1, 2, 5, 10]) {
      if (f * mag >= rough) return f * mag;
    }
    return 10 * mag;
  }

  const yTicks = $derived.by(() => {
    const step = niceStep(maxVal);
    const ticks: number[] = [];
    for (let v = 0; v <= maxVal + step * 0.1; v += step) ticks.push(v);
    return ticks;
  });

  function monthLabel(bucket: string): string {
    const [y, m] = bucket.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short' });
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      width = container.clientWidth;
    });
    ro.observe(container);
    width = container.clientWidth;
    return () => ro.disconnect();
  });
</script>

<div bind:this={container} class="w-full" style="height: {height}px">
  {#if width > 0}
    <svg {width} {height}>
      {#each yTicks as tick}
        <line
          x1={PAD.left}
          y1={toY(tick)}
          x2={PAD.left + plotW}
          y2={toY(tick)}
          class="grid-line"
        />
        <text x={PAD.left - 6} y={toY(tick) + 4} text-anchor="end" class="axis-lbl">
          {formatMoneyCompact(tick, { currency, locale })}
        </text>
      {/each}

      {#each data as d, i}
        <rect x={ix(i)} y={toY(d.income)} width={barW} height={bh(d.income)} rx="3" class="bar-income" />
        <rect x={sx(i)} y={toY(d.spending)} width={barW} height={bh(d.spending)} rx="3" class="bar-expense" />
        <text
          x={PAD.left + i * groupW + groupW / 2}
          y={height - 6}
          text-anchor="middle"
          class="axis-lbl"
        >
          {monthLabel(d.bucket)}
        </text>
      {/each}
    </svg>
  {/if}
</div>

<style>
  .grid-line {
    stroke: rgb(var(--c-hairline));
    stroke-width: 1;
  }
  .axis-lbl {
    fill: rgb(var(--c-muted));
    font: 11px 'Inter Variable', Inter, sans-serif;
  }
  .bar-income {
    fill: rgb(var(--c-income) / 0.72);
    transition: fill 100ms;
  }
  .bar-income:hover {
    fill: rgb(var(--c-income));
  }
  .bar-expense {
    fill: rgb(var(--c-expense) / 0.72);
    transition: fill 100ms;
  }
  .bar-expense:hover {
    fill: rgb(var(--c-expense));
  }
</style>
