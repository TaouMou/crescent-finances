<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    padded = true,
    children
  }: { class?: string; padded?: boolean; children: Snippet } = $props();

  const rnd = (min: number, max: number) => Math.random() * (max - min) + min;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Random bokeh per card (new on each load): each blob is a random palette
  // colour placed near a random corner, kept transparent via --bokeh-a* so it
  // reads as a faint sheen. Corners keep the centre clear for text/data.
  const corner = () => ({
    x: pick([rnd(-30, 15), rnd(85, 130)]),
    y: pick([rnd(-30, 15), rnd(85, 130)])
  });
  const blob = (aVar: string) => {
    const { x, y } = corner();
    // Soft perspective-light touch (neutral, theme-aware via --bokeh-color):
    // large radius + far-out transparent stop for a gradual, edge-less wash.
    const s = rnd(170, 240);
    return `radial-gradient(${s}% ${s}% at ${x}% ${y}%, rgb(var(--bokeh-color) / var(${aVar})), transparent ${rnd(80, 98)}%)`;
  };
  const bokeh = [blob('--bokeh-a1'), blob('--bokeh-a2')].join(', ');
</script>

<div class={cn('card', padded && 'p-5', className)} style={`background-image:${bokeh}`}>
  {@render children()}
</div>
