<script lang="ts">
  import { List, Faders } from 'phosphor-svelte';
  import { Button } from '$lib/components/ui/button';

  let {
    title = 'Dashboard',
    showPanel = false,
    onMenu,
    onPanel
  }: {
    title?: string;
    showPanel?: boolean;
    onMenu?: () => void;
    onPanel?: () => void;
  } = $props();
</script>

<header
  class="relative flex h-14 shrink-0 items-center gap-3 overflow-hidden border-b border-hairline px-4 md:px-6"
>
  <!-- Faint accent wash along the leading edge -->
  <div class="topbar-aurora pointer-events-none absolute inset-0" aria-hidden="true"></div>

  <!-- Menu toggle: only on mobile; desktop has a persistent nav rail. -->
  <Button
    variant="ghost"
    size="icon"
    class="relative z-10 shrink-0 text-muted hover:text-ink lg:hidden"
    onclick={() => onMenu?.()}
    aria-label="Open menu"
  >
    <List class="h-5 w-5" />
  </Button>
  <h1 class="relative z-10 min-w-0 truncate text-base font-semibold tracking-tight text-ink">{title}</h1>

  {#if showPanel}
    <div class="relative z-10 ml-auto lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        class="shrink-0 text-muted hover:text-ink"
        onclick={() => onPanel?.()}
        aria-label="Toggle details panel"
      >
        <Faders class="h-[18px] w-[18px]" />
      </Button>
    </div>
  {/if}
</header>
