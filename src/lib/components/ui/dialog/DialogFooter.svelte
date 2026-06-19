<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet } = $props();
</script>

<div
  class={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
  {...restProps}
>
  {@render children?.()}
</div>
