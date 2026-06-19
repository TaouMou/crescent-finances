<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import { CaretUpDown } from 'phosphor-svelte';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className,
    children,
    ...restProps
  }: SelectPrimitive.TriggerProps & { class?: string; children?: Snippet } = $props();
</script>

<SelectPrimitive.Trigger
  class={cn(
    'press flex h-9 w-full items-center justify-between rounded-control border border-hairline bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
    className
  )}
  {...restProps}
>
  {@render children?.()}
  <CaretUpDown class="h-4 w-4 shrink-0 text-muted" />
</SelectPrimitive.Trigger>
