<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { X } from 'phosphor-svelte';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import DialogOverlay from './DialogOverlay.svelte';

  let {
    class: className = '',
    children,
    ...restProps
  }: {
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<DialogPrimitive.Portal>
  <DialogOverlay />
  <DialogPrimitive.Content
    class={cn(
      'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
    <DialogPrimitive.Close
      class="press absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-control text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
    >
      <X class="h-4 w-4" />
      <span class="sr-only">Close</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
