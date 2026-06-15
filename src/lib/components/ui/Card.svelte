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
  const palette = ['--c-accent', '--c-income', '--c-expense', '--c-warn'];
  const corner = () => ({
    x: pick([rnd(-12, 28), rnd(72, 112)]),
    y: pick([rnd(-12, 28), rnd(72, 112)])
  });
  const blob = (aVar: string) => {
    const { x, y } = corner();
    const s = rnd(95, 140);
    return `radial-gradient(${s}% ${s}% at ${x}% ${y}%, rgb(var(${pick(palette)}) / var(${aVar})), transparent ${rnd(52, 62)}%)`;
  };
  const bokeh = [blob('--bokeh-a1'), blob('--bokeh-a2')].join(', ');
</script>

<div class={cn('card', padded && 'p-5', className)} style={`background-image:${bokeh}`}>
  {@render children()}
</div>
