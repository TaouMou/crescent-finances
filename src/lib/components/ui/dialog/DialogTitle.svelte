<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className,
    children,
    ...restProps
  }: DialogPrimitive.TitleProps & { class?: string; children?: Snippet } = $props();
</script>

<DialogPrimitive.Title
  class={cn('text-base font-semibold leading-none tracking-tight text-ink', className)}
  {...restProps}
>
  {@render children?.()}
</DialogPrimitive.Title>
