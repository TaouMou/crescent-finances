<script lang="ts">
  import { formatMoneyCompact } from '$lib/utils/currency';
  import type { MonthlyNet } from '$lib/aggregations';

  let {
    data,
    currency = 'EUR',
    locale = 'en-US',
    height = 240
  }: { data: MonthlyNet[]; currency?: string; locale?: string; height?: number } = $props();

  const PAD_L = 56;
  const PAD_R = 12;
  const PAD_T = 8;
  const PAD_B = 36;

  let containerWidth = $state(0);
  const svgWidth = $derived(Math.max(containerWidth, 1));
  const chartW = $derived(svgWidth - PAD_L - PAD_R);
  const chartH = $derived(height - PAD_T - PAD_B);

  const sorted = $derived([...data].sort((a, b) => a.bucket.localeCompare(b.bucket)));
  const n = $derived(sorted.length);

  const maxVal = $derived(Math.max(...sorted.flatMap((m) => [m.income, m.spending]), 1));

  function niceTop(v: number): number {
    if (v <= 0) return 100;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const frac = v / exp;
    const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * exp;
  }

  const yTop = $derived(niceTop(maxVal));
  const yTicks = $derived([0, yTop * 0.25, yTop * 0.5, yTop * 0.75, yTop]);

  const innerGap = 2;
  const groupW = $derived(n > 0 ? chartW / n : chartW);
  const barW = $derived(Math.min(40, Math.max(4, (groupW * 0.7 - innerGap) / 2)));

  function vy(val: number): number {
    return PAD_T + chartH - Math.max(0, (val / yTop) * chartH);
  }

  function vh(val: number): number {
    return Math.max(0, (val / yTop) * chartH);
  }

  function barGroupX(i: number): number {
    return PAD_L + i * groupW + (groupW - barW * 2 - innerGap) / 2;
  }

  function monthLabel(bucket: string): string {
    const [y, m] = bucket.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString(locale, { month: 'short' });
  }
</script>

<!-- Legend -->
<div class="mb-3 flex items-center gap-4">
  <div class="flex items-center gap-1.5">
    <span class="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-income/80"></span>
    <span class="text-xs text-muted">Income</span>
  </div>
  <div class="flex items-center gap-1.5">
    <span class="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-expense/80"></span>
    <span class="text-xs text-muted">Spending</span>
  </div>
</div>

<div bind:clientWidth={containerWidth} class="w-full" style="height: {height}px; overflow: hidden;">
  {#if containerWidth > 0 && n > 0}
    <svg width={svgWidth} {height}>
      <!-- Y-axis grid lines + labels -->
      {#each yTicks as tick (tick)}
        {@const y = vy(tick)}
        <line
          x1={PAD_L}
          y1={y}
          x2={svgWidth - PAD_R}
          y2={y}
          style="stroke: rgb(var(--c-hairline)); stroke-width: 1"
        />
        {#if tick > 0}
          <text
            x={PAD_L - 6}
            y={y}
            text-anchor="end"
            dominant-baseline="middle"
            style="fill: rgb(var(--c-muted)); font-size: 11px; font-family: Inter Variable, Inter, sans-serif;"
          >
            {formatMoneyCompact(Math.round(tick), { currency, locale })}
          </text>
        {/if}
      {/each}

      <!-- Bars + month labels -->
      {#each sorted as m, i (m.bucket)}
        {@const x = barGroupX(i)}
        {@const groupCenter = PAD_L + i * groupW + groupW / 2}
        {@const incH = vh(m.income)}
        {@const spH = vh(m.spending)}

        <!-- Income bar -->
        <rect
          x={x}
          y={vy(m.income)}
          width={barW}
          height={incH}
          rx="2"
          style="fill: rgb(var(--c-income) / 0.8)"
        />

        <!-- Spending bar -->
        <rect
          x={x + barW + innerGap}
          y={vy(m.spending)}
          width={barW}
          height={spH}
          rx="2"
          style="fill: rgb(var(--c-expense) / 0.8)"
        />

        <!-- Month label -->
        <text
          x={groupCenter}
          y={height - PAD_B + 16}
          text-anchor="middle"
          style="fill: rgb(var(--c-muted)); font-size: 11px; font-family: Inter Variable, Inter, sans-serif;"
        >
          {monthLabel(m.bucket)}
        </text>
      {/each}
    </svg>
  {/if}
</div>
