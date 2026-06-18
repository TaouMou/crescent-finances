<script lang="ts">
  import { List, Faders } from 'phosphor-svelte';

  let {
    title = 'Dashboard',
    onMenu,
    onPanel
  }: {
    title?: string;
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

  <div class="ml-auto">
    <button
      class="press grid h-9 w-9 shrink-0 place-items-center rounded-control border border-hairline bg-surface text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => onPanel?.()}
      aria-label="Toggle details panel"
    >
      <Faders class="h-[18px] w-[18px]" />
    </button>
  </div>
</header>
