<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    padded = true,
    /** CSS color token (e.g. '--c-accent', '--c-income') the card "shines" with. */
    tint = '--c-accent',
    children
  }: { class?: string; padded?: boolean; tint?: string; children: Snippet } = $props();

  // Soft glow in the card's own colour — two corner blobs, kept transparent so
  // it reads as a gentle sheen rather than colour.
  const bokeh = $derived(
    `radial-gradient(120% 120% at 0% 0%, rgb(var(${tint}) / var(--bokeh-a1)), transparent 55%), ` +
      `radial-gradient(110% 110% at 100% 100%, rgb(var(${tint}) / var(--bokeh-a2)), transparent 60%)`
  );
</script>

<div class={cn('card', padded && 'p-5', className)} style={`background-image:${bokeh}`}>
  {@render children()}
</div>
