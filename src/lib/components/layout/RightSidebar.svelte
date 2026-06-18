<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X } from 'phosphor-svelte';
  import DateField from '$lib/components/ui/DateField.svelte';
  import { toISODate } from '$lib/utils/dates';

  let {
    route = 'dashboard',
    fromStr = $bindable(''),
    toStr = $bindable(''),
    spanLabel = '',
    onClose
  }: {
    route?: string;
    fromStr?: string;
    toStr?: string;
    spanLabel?: string;
    onClose?: () => void;
  } = $props();

  const today = new Date();

  function setPreset(days: number) {
    const from = new Date(today);
    from.setDate(today.getDate() - days);
    fromStr = toISODate(from);
    toStr = toISODate(today);
  }

  function setYearToDate() {
    fromStr = toISODate(new Date(today.getFullYear(), 0, 1));
    toStr = toISODate(today);
  }

  const presets = [
    { label: 'Last 30 days', action: () => setPreset(30) },
    { label: 'Last 3 months', action: () => setPreset(90) },
    { label: 'Last 6 months', action: () => setPreset(180) },
    { label: 'Last year', action: () => setPreset(365) },
    { label: 'Year to date', action: () => setYearToDate() }
  ];
</script>

<!-- Backdrop -->
<button
  class="fixed inset-0 z-40 w-full bg-ink/40"
  transition:fade={{ duration: 200 }}
  onclick={() => onClose?.()}
  aria-label="Close panel"
></button>

<!-- Drawer -->
<div
  class="fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col border-l border-hairline bg-paper overscroll-contain"
  transition:fly={{ x: 280, duration: 250, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4">
    <span class="text-sm font-medium text-ink">
      {route === 'dashboard' ? 'Filters' : 'Details'}
    </span>
    <button
      class="press grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => onClose?.()}
      aria-label="Close panel"
    >
      <X class="h-5 w-5" />
    </button>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
    {#if route === 'dashboard'}
      <!-- Quick presets -->
      <p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted/60">Quick range</p>
      <div class="space-y-1">
        {#each presets as p (p.label)}
          <button
            class="press flex h-8 w-full items-center rounded-control px-2.5 text-left text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
            onclick={p.action}
          >
            {p.label}
          </button>
        {/each}
      </div>

      <!-- Date pickers — shown on mobile where topbar hides them -->
      <div class="mt-5 md:hidden">
        <p class="mb-2 text-xs font-medium uppercase tracking-wider text-muted/60">Custom range</p>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
          <DateField bind:value={fromStr} max={toStr} label="Start date" />
          <span class="text-muted">–</span>
          <DateField bind:value={toStr} min={fromStr} label="End date" />
        </div>
        {#if spanLabel}
          <p class="mt-2 text-xs text-muted">{spanLabel}</p>
        {/if}
      </div>
    {:else}
      <p class="text-sm text-muted">No details available for this page.</p>
    {/if}
  </div>
</div>
