<script lang="ts">
  import { CalendarBlank } from 'phosphor-svelte';

  let {
    value = $bindable(),
    min,
    max,
    label
  }: { value: string; min?: string; max?: string; label: string } = $props();

  let input: HTMLInputElement;

  // Show a clean, on-brand date instead of the browser's raw "mm/dd/yyyy".
  const display = $derived(
    value
      ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : 'Select date'
  );

  function open() {
    // showPicker() must run from a user gesture (the click). Fall back to focus.
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }
</script>

<div class="relative inline-flex">
  <button
    type="button"
    onclick={open}
    aria-label={label}
    class="press inline-flex h-8 items-center gap-1.5 rounded-control bg-ink/[0.04] px-2.5 text-xs font-medium text-muted hover:bg-ink/[0.08] hover:text-ink active:bg-ink/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
  >
    <CalendarBlank class="h-3.5 w-3.5 shrink-0" />
    <span class="tnum">{display}</span>
  </button>
  <!-- Real control: visually hidden but rendered so the native picker anchors here. -->
  <input
    bind:this={input}
    type="date"
    bind:value
    {min}
    {max}
    tabindex="-1"
    aria-hidden="true"
    class="pointer-events-none absolute bottom-0 left-3 h-px w-px opacity-0"
  />
</div>
