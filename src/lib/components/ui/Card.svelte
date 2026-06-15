<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import type { Snippet } from 'svelte';

  let {
    class: className = '',
    padded = true,
    children
  }: { class?: string; padded?: boolean; children: Snippet } = $props();
</script>

<div class={cn('card', padded && 'p-5', className)}>
  {@render children()}
</div>
