<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import DialogContent from '$lib/components/ui/dialog/DialogContent.svelte';
  import DialogHeader from '$lib/components/ui/dialog/DialogHeader.svelte';
  import DialogTitle from '$lib/components/ui/dialog/DialogTitle.svelte';

  let {
    open = $bindable(false),
    title,
    children
  }: {
    open: boolean;
    title: string;
    children: Snippet;
  } = $props();
</script>

<DialogPrimitive.Root bind:open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    {@render children()}
  </DialogContent>
</DialogPrimitive.Root>
