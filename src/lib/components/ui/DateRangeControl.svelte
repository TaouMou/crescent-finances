<script lang="ts">
  import DateField from '$lib/components/ui/DateField.svelte';
  import { toISODate } from '$lib/utils/dates';
  import { cn } from '$lib/utils/cn';

  // Compact horizontal date-range picker for the desktop dashboard header.
  // (The mobile right-hand drawer has its own sectioned layout.)
  let {
    fromStr = $bindable(''),
    toStr = $bindable(''),
    spanLabel = '',
    class: className = ''
  }: {
    fromStr?: string;
    toStr?: string;
    spanLabel?: string;
    class?: string;
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
    { short: '30d', label: 'Last 30 days', action: () => setPreset(30) },
    { short: '3m', label: 'Last 3 months', action: () => setPreset(90) },
    { short: '6m', label: 'Last 6 months', action: () => setPreset(180) },
    { short: '1y', label: 'Last year', action: () => setPreset(365) },
    { short: 'YTD', label: 'Year to date', action: () => setYearToDate() }
  ];
</script>

<div class={cn('flex flex-wrap items-center gap-x-2 gap-y-2', className)}>
  <div class="flex items-center gap-1">
    {#each presets as p (p.label)}
      <button
        class="press h-8 rounded-control border border-hairline bg-surface px-2.5 text-xs font-medium text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        onclick={p.action}
        title={p.label}
      >
        {p.short}
      </button>
    {/each}
  </div>
  <div class="flex items-center gap-1.5">
    <DateField bind:value={fromStr} max={toStr} label="Start date" />
    <span class="text-muted">–</span>
    <DateField bind:value={toStr} min={fromStr} label="End date" />
  </div>
  {#if spanLabel}
    <span class="text-xs text-muted/70">{spanLabel}</span>
  {/if}
</div>
