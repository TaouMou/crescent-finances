<script lang="ts">
  import { Calendar } from 'lucide-svelte';

  let {
    value = $bindable(),
    min,
    max,
    label
  }: { value: string; min?: string; max?: string; label: string } = $props();
</script>

<!--
  The native date input draws its own calendar glyph that ignores `color`.
  We hide it (kept transparent but still clickable on the right) and overlay
  a themed icon so it follows the muted token and adapts to dark mode.
-->
<div class="relative inline-flex items-center">
  <input
    type="date"
    bind:value
    {min}
    {max}
    aria-label={label}
    class="date-native h-8 w-[150px] rounded-control bg-ink/[0.04] px-2 pr-8 text-xs font-medium text-muted [color-scheme:light] transition-colors hover:bg-ink/[0.07] focus-visible:outline-none dark:[color-scheme:dark]"
  />
  <Calendar class="pointer-events-none absolute right-2 h-4 w-4 text-muted" strokeWidth={1.75} />
</div>
