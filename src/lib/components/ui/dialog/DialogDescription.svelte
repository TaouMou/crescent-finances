<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className,
    children,
    ...restProps
  }: DialogPrimitive.DescriptionProps & { class?: string; children?: Snippet } = $props();
</script>

<DialogPrimitive.Description
  class={cn('text-sm text-muted', className)}
  {...restProps}
>
  {@render children?.()}
</DialogPrimitive.Description>
