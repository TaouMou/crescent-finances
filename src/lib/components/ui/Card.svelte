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
  // Two *distinct* palette colours per card, spread differently each load.
  const [hue1, hue2] = [...palette].sort(() => Math.random() - 0.5);
  const corner = () => ({
    x: pick([rnd(-30, 15), rnd(85, 130)]),
    y: pick([rnd(-30, 15), rnd(85, 130)])
  });
  const blob = (aVar: string, hue: string) => {
    const { x, y } = corner();
    // Large radius + far-out transparent stop = a soft, gradual wash (no visible
    // colour edge).
    const s = rnd(170, 240);
    return `radial-gradient(${s}% ${s}% at ${x}% ${y}%, rgb(var(${hue}) / var(${aVar})), transparent ${rnd(80, 98)}%)`;
  };
  const bokeh = [blob('--bokeh-a1', hue1), blob('--bokeh-a2', hue2)].join(', ');
</script>

<div class={cn('card', padded && 'p-5', className)} style={`background-image:${bokeh}`}>
  {@render children()}
</div>
