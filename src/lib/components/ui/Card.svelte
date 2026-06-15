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

  // A calm, accent-dominant bokeh, randomized per card on each load. The first
  // blob is always the accent; the second is occasionally a muted secondary so
  // there's variety across cards without getting colorful. Intensity comes from
  // the theme-aware --bokeh-a* vars on .card.
  const bokeh = (() => {
    const b1 = {
      hue: '--c-accent',
      a: '--bokeh-a1',
      x: rnd(-5, 35),
      y: rnd(-10, 25),
      s: rnd(95, 135)
    };
    const b2 = {
      hue: pick(['--c-accent', '--c-accent', '--c-warn', '--c-income']),
      a: '--bokeh-a2',
      x: rnd(65, 105),
      y: rnd(70, 110),
      s: rnd(90, 130)
    };
    return [b1, b2]
      .map(
        (b) =>
          `radial-gradient(${b.s}% ${b.s}% at ${b.x}% ${b.y}%, rgb(var(${b.hue}) / var(${b.a})), transparent 55%)`
      )
      .join(', ');
  })();
</script>

<div class={cn('card', padded && 'p-5', className)} style={`background-image:${bokeh}`}>
  {@render children()}
</div>
