<script lang="ts">
  import { List, Faders } from 'phosphor-svelte';
  import DateField from '$lib/components/ui/DateField.svelte';

  let {
    title = 'Dashboard',
    route = '',
    fromStr = $bindable(''),
    toStr = $bindable(''),
    spanLabel = '',
    onMenu,
    onPanel
  }: {
    title?: string;
    route?: string;
    fromStr?: string;
    toStr?: string;
    spanLabel?: string;
    onMenu?: () => void;
    onPanel?: () => void;
  } = $props();
</script>

<header class="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-4 md:px-6">
  <button
    class="press grid h-9 w-9 shrink-0 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
    onclick={() => onMenu?.()}
    aria-label="Open menu"
  >
    <List class="h-5 w-5" />
  </button>
  <h1 class="min-w-0 truncate text-base font-medium text-ink">{title}</h1>

  <div class="ml-auto flex items-center gap-2">
    {#if route === 'dashboard'}
      <div class="hidden items-center gap-2 md:flex">
        <DateField bind:value={fromStr} max={toStr} label="Start date" />
        <span class="text-sm text-muted">–</span>
        <DateField bind:value={toStr} min={fromStr} label="End date" />
        {#if spanLabel}
          <span class="whitespace-nowrap text-xs text-muted">{spanLabel}</span>
        {/if}
      </div>
    {/if}
    <button
      class="press grid h-9 w-9 shrink-0 place-items-center rounded-control border border-hairline bg-surface text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => onPanel?.()}
      aria-label="Toggle details panel"
    >
      <Faders class="h-[18px] w-[18px]" />
    </button>
  </div>
</header>
