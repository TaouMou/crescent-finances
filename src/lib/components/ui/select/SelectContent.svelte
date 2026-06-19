<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className,
    sideOffset = 4,
    children,
    ...restProps
  }: SelectPrimitive.ContentProps & { class?: string; children?: Snippet } = $props();
</script>

<SelectPrimitive.Portal>
  <SelectPrimitive.Content
    {sideOffset}
    class={cn(
      'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-card border border-hairline bg-surface text-ink shadow-[var(--shadow-card)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...restProps}
  >
    <SelectPrimitive.Viewport class="p-1">
      {@render children?.()}
    </SelectPrimitive.Viewport>
  </SelectPrimitive.Content>
</SelectPrimitive.Portal>
