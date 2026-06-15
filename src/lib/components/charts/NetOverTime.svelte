<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type UplotType from 'uplot';
  import { formatMoneyCompact } from '$lib/utils/currency';
  import type { NetPoint } from '$lib/seed/dashboard';

  let {
    data,
    currency = 'EUR',
    locale = 'en-US',
    height = 220
  }: { data: NetPoint[]; currency?: string; locale?: string; height?: number } = $props();

  let el: HTMLDivElement;
  let chart: UplotType | null = null;

  // Tokens are space-separated RGB channels, e.g. "20 119 107".
  function channels(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // Push new data into the chart when the selected timeframe changes.
  $effect(() => {
    const xs = data.map((d) => d.t);
    const ys = data.map((d) => d.value / 100);
    untrack(() => chart?.setData([xs, ys]));
  });

  onMount(() => {
    let ro: ResizeObserver | null = null;
    let disposed = false;

    // uPlot is dynamically imported so it ships only with the dashboard chunk.
    (async () => {
      const uPlot = (await import('uplot')).default;
      await import('uplot/dist/uPlot.min.css');
      if (disposed) return;

      const accentCh = channels('--c-accent', '20 119 107');
      const accent = `rgb(${accentCh})`;
      const ink = `rgb(${channels('--c-muted', '110 122 130')})`;
      const grid = `rgb(${channels('--c-hairline', '227 231 229')})`;

      const xs = data.map((d) => d.t);
      const ys = data.map((d) => d.value / 100);

      const make = (width: number) =>
        new uPlot(
          {
            width,
            height,
            // Hover readout only — no drag-to-zoom (timeframe is set via selectors).
            cursor: { points: { size: 6 }, y: false, drag: { x: false, y: false, setScale: false } },
            legend: { show: false },
            scales: { x: { time: true } },
            axes: [
              {
                stroke: ink,
                grid: { show: false },
                ticks: { show: false },
                font: '12px Inter Variable, Inter, sans-serif',
                space: 64,
                values: (_u, splits) =>
                  splits.map((s) =>
                    new Date(s * 1000).toLocaleDateString(locale, { month: 'short' })
                  )
              },
              {
                stroke: ink,
                grid: { stroke: grid, width: 1 },
                ticks: { show: false },
                font: '12px Inter Variable, Inter, sans-serif',
                size: 56,
                values: (_u, splits) =>
                  splits.map((s) => formatMoneyCompact(Math.round(s * 100), { currency, locale }))
              }
            ],
            series: [
              {},
              {
                stroke: accent,
                width: 2.5,
                fill: (u) => {
                  const ctx = u.ctx;
                  const g = ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
                  g.addColorStop(0, `rgb(${accentCh} / 0.16)`);
                  g.addColorStop(1, `rgb(${accentCh} / 0)`);
                  return g;
                },
                points: { show: false }
              }
            ]
          },
          [xs, ys],
          el
        );

      // Create the chart only once we have a real width, then track resizes.
      // Avoids a zero-width first paint (which leaves the series blank on mobile).
      ro = new ResizeObserver(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        if (!chart) chart = make(w);
        else chart.setSize({ width: w, height });
      });
      ro.observe(el);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      chart?.destroy();
      chart = null;
    };
  });
</script>

<div bind:this={el} class="w-full" style={`height:${height}px`}></div>
