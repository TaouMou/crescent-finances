<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { theme } from '$lib/stores/theme';
  import type UplotType from 'uplot';
  import type { MonthlyNet } from '$lib/aggregations';

  type UPlotInstance = UplotType;
  type UPlotData = [number[], number[]];
  type UPlotCtor = new (opts: object, data: UPlotData, target: HTMLElement) => UPlotInstance;

  let {
    data,
    height = 160
  }: { data: MonthlyNet[]; height?: number } = $props();

  let el: HTMLDivElement;
  let UPlot: UPlotCtor | null = null;
  let chart: UPlotInstance | null = null;
  let width = 0;

  function channels(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function dataset(): UPlotData {
    return [
      data.map((d) => Math.floor(new Date(`${d.bucket}-01T00:00:00Z`).getTime() / 1000)),
      data.map((d) => (d.income > 0 ? Math.round((d.net / d.income) * 1000) / 10 : 0))
    ];
  }

  function buildOptions(): object {
    const accentCh = channels('--c-accent', '13 168 130');
    const ink = `rgb(${channels('--c-muted', '110 122 130')})`;
    const grid = `rgb(${channels('--c-hairline', '214 208 196')})`;
    const isDark = document.documentElement.classList.contains('dark');
    const fillTop = isDark ? 0.14 : 0.07;

    return {
      width,
      height,
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
          values: (_u: UPlotInstance, splits: number[]) =>
            splits.map((s: number) =>
              new Date(s * 1000).toLocaleDateString('en-US', { month: 'short' })
            )
        },
        {
          stroke: ink,
          grid: { stroke: grid, width: 1 },
          ticks: { show: false },
          font: '12px Inter Variable, Inter, sans-serif',
          size: 48,
          values: (_u: UPlotInstance, splits: number[]) =>
            splits.map((s: number) => `${s}%`)
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

  $effect(() => {
    $theme;
    untrack(() => render());
  });

  $effect(() => {
    const d = dataset();
    untrack(() => chart?.setData(d));
  });

  onMount(() => {
    let ro: ResizeObserver | null = null;
    let disposed = false;

    (async () => {
      UPlot = (await import('uplot')).default as unknown as UPlotCtor;
      await import('uplot/dist/uPlot.min.css');
      if (disposed) return;

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

<div bind:this={el} class="w-full" style="height: {height}px"></div>
