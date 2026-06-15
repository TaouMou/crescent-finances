<script lang="ts">
  import { MagnifyingGlass, CaretDown, List } from 'phosphor-svelte';

  let {
    title = 'Dashboard',
    period = 'June 2026',
    onMenu
  }: { title?: string; period?: string; onMenu?: () => void } = $props();
</script>

<header class="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-4 md:px-6">
  <button
    class="press grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10 md:hidden"
    onclick={() => onMenu?.()}
    aria-label="Open menu"
  >
    <List class="h-5 w-5" />
  </button>
  <h1 class="text-base font-medium text-ink">{title}</h1>

  <div class="ml-auto flex items-center gap-2">
    <button
      class="press flex h-9 items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm text-ink hover:bg-ink/5 active:bg-ink/10"
    >
      <span class="tnum">{period}</span>
      <CaretDown class="h-4 w-4 text-muted" />
    </button>
    <button
      class="press grid h-9 w-9 place-items-center rounded-control border border-hairline bg-surface text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      aria-label="Search"
    >
      <MagnifyingGlass class="h-[18px] w-[18px]" />
    </button>
  </div>
</header>
