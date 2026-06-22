<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X } from 'phosphor-svelte';
  import DateField from '$lib/components/ui/DateField.svelte';
  import HelpPanel from './HelpPanel.svelte';
  import { pageHelp } from '$lib/help/registry';
  import { toISODate } from '$lib/utils/dates';

  let {
    route = 'month',
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

  const help = $derived(pageHelp[route]);
  const headerLabel = $derived(route === 'statistics' ? 'Filters' : help ? 'Help' : 'Details');
</script>

<!-- Backdrop -->
<button
  class="fixed inset-0 z-40 w-full bg-black/40"
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
    <span class="text-sm font-medium text-ink">{headerLabel}</span>
    <button
      class="press grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => onClose?.()}
      aria-label="Close panel"
    >
      <X class="h-5 w-5" />
    </button>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto overscroll-contain px-4 py-2">
    {#if route === 'statistics'}
      <div class="divide-y divide-hairline">
        <!-- Quick presets -->
        <section class="py-4 first:pt-2">
          <h3 class="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            <span class="h-3 w-0.5 rounded-full bg-accent/60"></span>Quick range
          </h3>
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
        </section>

        <!-- Custom date range -->
        <section class="py-4">
          <h3 class="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            <span class="h-3 w-0.5 rounded-full bg-accent/60"></span>Custom range
          </h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted">From</span>
              <DateField bind:value={fromStr} max={toStr} label="Start date" />
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted">To</span>
              <DateField bind:value={toStr} min={fromStr} label="End date" />
            </div>
          </div>
          {#if spanLabel}
            <p class="mt-3 text-xs text-muted">{spanLabel}</p>
          {/if}
        </section>

        {#if help}
          <section class="py-4 last:pb-2">
            <h3 class="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              <span class="h-3 w-0.5 rounded-full bg-accent/60"></span>About this page
            </h3>
            <HelpPanel {help} />
          </section>
        {/if}
      </div>
    {:else if help}
      <section class="py-2">
        <h3 class="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          <span class="h-3 w-0.5 rounded-full bg-accent/60"></span>{help.title}
        </h3>
        <HelpPanel {help} />
      </section>
    {:else}
      <p class="py-2 text-sm text-muted">No details available for this page.</p>
    {/if}
  </div>
</div>
