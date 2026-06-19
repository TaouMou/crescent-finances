<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import { Check } from 'phosphor-svelte';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className,
    value,
    label,
    children,
    ...restProps
  }: SelectPrimitive.ItemProps & { class?: string; children?: Snippet } = $props();
</script>

<SelectPrimitive.Item
  {value}
  {label}
  class={cn(
    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-ink outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-ink/5 data-[disabled]:opacity-50',
    className
  )}
  {...restProps}
>
  {#snippet children({ selected })}
    <span class="absolute left-2 flex h-4 w-4 items-center justify-center">
      {#if selected}
        <Check class="h-4 w-4 text-accent" />
      {/if}
    </span>
    <span>{label}</span>
  {/snippet}
</SelectPrimitive.Item>
