<script lang="ts">
  import { CalendarDots, CaretLeft, CaretRight } from 'phosphor-svelte';
  import { scale } from 'svelte/transition';
  import { toISODate } from '$lib/utils/dates';

  let {
    value = $bindable(),
    min,
    max,
    label
  }: { value: string; min?: string; max?: string; label: string } = $props();

  const reduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let open = $state(false);
  // The month currently shown in the popover.
  let view = $state(new Date(`${value}T00:00:00`));

  const today = new Date();
  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const display = $derived(
    value
      ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : 'Select date'
  );

  const monthLabel = $derived(
    view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  );

  // 6 weeks × 7 days covering the visible month (with leading/trailing days).
  const days = $derived.by(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  });

  function sameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  function disabled(d: Date) {
    const s = toISODate(d);
    return (min != null && s < min) || (max != null && s > max);
  }

  function toggle() {
    if (!open) view = new Date(`${value}T00:00:00`);
    open = !open;
  }
  function pick(d: Date) {
    if (disabled(d)) return;
    value = toISODate(d);
    open = false;
  }
  function step(n: number) {
    view = new Date(view.getFullYear(), view.getMonth() + n, 1);
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') open = false;
  }}
/>

<div class="relative inline-block">
  <button
    type="button"
    onclick={toggle}
    aria-label={label}
    aria-haspopup="dialog"
    aria-expanded={open}
    class="press inline-flex h-8 items-center gap-1.5 rounded-control border border-hairline bg-surface px-2.5 text-xs font-medium text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
  >
    <CalendarDots class="h-3.5 w-3.5 shrink-0" />
    <span class="tnum whitespace-nowrap">{display}</span>
  </button>

  {#if open}
    <!-- click-away layer -->
    <button
      class="fixed inset-0 z-40 cursor-default"
      tabindex="-1"
      aria-hidden="true"
      onclick={() => (open = false)}
    ></button>

    <div
      class="absolute left-0 top-full z-50 mt-2 w-[244px] origin-top rounded-card bg-surface p-3 ring-1 ring-hairline"
      style="box-shadow: var(--shadow-card)"
      role="dialog"
      aria-label={label}
      transition:scale={{ duration: reduce ? 0 : 150, start: 0.96, opacity: 0 }}
    >
      <div class="mb-2 flex items-center justify-between">
        <button
          type="button"
          class="press grid h-7 w-7 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
          onclick={() => step(-1)}
          aria-label="Previous month"
        >
          <CaretLeft class="h-4 w-4" />
        </button>
        <span class="text-sm font-medium text-ink">{monthLabel}</span>
        <button
          type="button"
          class="press grid h-7 w-7 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
          onclick={() => step(1)}
          aria-label="Next month"
        >
          <CaretRight class="h-4 w-4" />
        </button>
      </div>

      <div class="mb-1 grid grid-cols-7 gap-0.5">
        {#each WEEKDAYS as w (w)}
          <span class="grid h-6 place-items-center text-[10px] font-medium text-muted/70">{w}</span>
        {/each}
      </div>

      <div class="grid grid-cols-7 gap-0.5">
        {#each days as d (d.getTime())}
          {@const sel = value && sameDay(d, new Date(`${value}T00:00:00`))}
          {@const off = d.getMonth() !== view.getMonth()}
          {@const dis = disabled(d)}
          <button
            type="button"
            disabled={dis}
            onclick={() => pick(d)}
            aria-label={d.toLocaleDateString(undefined, { dateStyle: 'full' })}
            aria-current={sameDay(d, today) ? 'date' : undefined}
            class="press grid h-8 place-items-center rounded-control text-xs tabular-nums transition-colors
              {sel
              ? 'bg-accent font-medium text-white hover:bg-accent'
              : dis
                ? 'cursor-not-allowed text-muted/30'
                : off
                  ? 'text-muted/50 hover:bg-ink/5'
                  : 'text-ink hover:bg-ink/5 active:bg-ink/10'}
              {sameDay(d, today) && !sel ? 'ring-1 ring-inset ring-accent/40' : ''}"
          >
            {d.getDate()}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
