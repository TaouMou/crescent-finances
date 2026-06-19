<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';

  interface Props extends HTMLInputAttributes {
    class?: string;
  }

  let { class: className, ...restProps }: Props = $props();
</script>

<input
  class={cn(
    'flex h-9 w-full rounded-control border border-hairline bg-transparent px-3 py-1 text-sm text-ink placeholder:text-muted shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...restProps}
/>
