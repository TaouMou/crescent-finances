<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import { formatMoneyCompact } from '$lib/utils/currency';
  import type UplotType from 'uplot';
  import type { NetPoint } from '$lib/seed/dashboard';

  type UPlotInstance = UplotType;
  type UPlotData = [number[], number[]];
  type UPlotCtor = new (opts: object, data: UPlotData, target: HTMLElement) => UPlotInstance;

  let {
    data,
    currency = 'EUR',
    locale = 'en-US',
    height = 220,
    xMin,
    xMax
  }: {
    data: NetPoint[];
    currency?: string;
    locale?: string;
    height?: number;
    // Epoch-second bounds pinning the x-axis to the selected timeframe.
    xMin?: number;
    xMax?: number;
  } = $props();

  let el: HTMLDivElement;
  let UPlot: UPlotCtor | null = null;
  let chart: UPlotInstance | null = null;
  let width = 0;

  // Tokens are space-separated RGB channels, e.g. "20 119 107".
  function channels(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function dataset(): UPlotData {
    return [data.map((d) => d.t), data.map((d) => d.value / 100)];
  }

  // Colors are read from the live CSS tokens, so options must be rebuilt per theme.
  function buildOptions(): object {
    const accentCh = channels('--c-accent', '20 119 107');
    const ink = `rgb(${channels('--c-muted', '110 122 130')})`;
    const grid = `rgb(${channels('--c-hairline', '227 231 229')})`;

    // The light accent is a deep teal, so the same opacity reads darker than in
    // dark mode — keep the area fill very faint in light mode.
    const isDark = document.documentElement.classList.contains('dark');
    const fillTop = isDark ? 0.12 : 0.05;
    const fillMid = isDark ? 0.03 : 0.012;

    return {
      width,
      height,
      // Hover readout only — no drag-to-zoom (timeframe is set via selectors).
      cursor: { points: { size: 6 }, y: false, drag: { x: false, y: false, setScale: false } },
      legend: { show: false },
      scales: {
        // Pin the x-axis to the picked window so the chart spans exactly the
        // selected dates regardless of where the data points fall.
        x: {
          time: true,
          range:
            xMin != null && xMax != null
              ? () => [xMin, xMax] as [number, number]
              : undefined
        }
      },
      axes: [
        {
          stroke: ink,
          grid: { show: false },
          ticks: { show: false },
          font: '12px Inter Variable, Inter, sans-serif',
          space: 64,
          values: (_u: UPlotInstance, splits: number[]) => {
            if (splits.length === 0) return [];
            const rangeS = splits[splits.length - 1] - splits[0];
            let opts: Intl.DateTimeFormatOptions;
            if (rangeS < 86400 * 60)       opts = { day: 'numeric', month: 'short' };
            else if (rangeS < 86400 * 730) opts = { month: 'short' };
            else                           opts = { year: 'numeric' };
            return splits.map((s: number) =>
              new Date(s * 1000).toLocaleDateString(locale, opts)
            );
          }
        },
        {
          stroke: ink,
          grid: { stroke: grid, width: 1 },
          ticks: { show: false },
          font: '12px Inter Variable, Inter, sans-serif',
          size: 56,
          values: (_u: UPlotInstance, splits: number[]) =>
            splits.map((s: number) => formatMoneyCompact(Math.round(s * 100), { currency, locale }))
        }
      ],
      series: [
        {},
        {
          stroke: `rgb(${accentCh})`,
          width: 2.5,
          fill: (u: UPlotInstance) => {
            const g = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
            g.addColorStop(0, `rgb(${accentCh} / ${fillTop})`);
            g.addColorStop(0.65, `rgb(${accentCh} / ${fillMid})`);
            g.addColorStop(1, `rgb(${accentCh} / 0)`);
            return g;
          },
          points: { show: false }
        }
      ]
    };
  }

  function render() {
    if (!UPlot || width === 0) return;
    chart?.destroy();
    chart = new UPlot(buildOptions(), dataset(), el);
  }

  // Rebuild when the theme changes so stroke/grid/fill follow the active palette.
  $effect(() => {
    $theme;
    untrack(() => render());
  });

  // Update data (and re-pin the x-axis) when the selected timeframe changes.
  $effect(() => {
    const d = dataset();
    const lo = xMin;
    const hi = xMax;
    untrack(() => {
      if (!chart) return;
      chart.setData(d); // y auto-rescales to the new data
      if (lo != null && hi != null) chart.setScale('x', { min: lo, max: hi });
    });
  });

  onMount(() => {
    let ro: ResizeObserver | null = null;
    let disposed = false;

    // uPlot is dynamically imported so it ships only with the dashboard chunk.
    (async () => {
      UPlot = (await import('uplot')).default as unknown as UPlotCtor;
      await import('uplot/dist/uPlot.min.css');
      if (disposed) return;

      // Create once we have a real width, then keep it sized to the container.
      ro = new ResizeObserver(() => {
        const w = el.clientWidth;
        if (w === 0 || w === width) return;
        width = w;
        if (!chart) render();
        else chart.setSize({ width, height });
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
