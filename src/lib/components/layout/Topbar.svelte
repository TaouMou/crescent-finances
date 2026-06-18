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

<header
  class="relative flex h-14 shrink-0 items-center gap-3 overflow-hidden border-b border-hairline px-4 md:px-6"
>
  <!-- Accent aurora glow along the top edge -->
  <div class="topbar-aurora pointer-events-none absolute inset-0" aria-hidden="true"></div>

  <button
    class="press control-well relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-control text-muted hover:text-ink active:bg-ink/10"
    onclick={() => onMenu?.()}
    aria-label="Open menu"
  >
    <List class="h-5 w-5" />
  </button>
  <h1 class="relative z-10 min-w-0 truncate text-base font-medium text-ink">{title}</h1>

  <div class="relative z-10 ml-auto">
    <button
      class="press control-well grid h-9 w-9 shrink-0 place-items-center rounded-control text-muted hover:text-ink active:bg-ink/10"
      onclick={() => onPanel?.()}
      aria-label="Toggle details panel"
    >
      <Faders class="h-[18px] w-[18px]" />
    </button>
  </div>
</header>
