<script lang="ts">
  import {
    SquaresFour,
    ArrowsLeftRight,
    ChartPieSlice,
    UploadSimple,
    GearSix,
    CaretRight,
    Moon,
    Sun,
    X
  } from 'phosphor-svelte';
  import { slide } from 'svelte/transition';
  import { theme } from '$lib/stores/theme';
  import { cn } from '$lib/utils/cn';

  let {
    active = 'dashboard',
    collapsed = $bindable(false),
    fullWidth = false,
    onClose
  }: {
    active?: string;
    collapsed?: boolean;
    fullWidth?: boolean;
    onClose?: () => void;
  } = $props();

  // Notion-style nested navigation. "Plan" expands into user-defined section groups.
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: SquaresFour },
    { id: 'transactions', label: 'Transactions', icon: ArrowsLeftRight }
  ];

  let planOpen = $state(true);
  // Section groups are user-created; shown here from a demo config.
  const planGroups = [
    { id: 'g1', label: 'Monthly plan' },
    { id: 'g2', label: 'Goals' }
  ];

  const footerNav = [
    { id: 'import', label: 'Import CSV', icon: UploadSimple },
    { id: 'settings', label: 'Settings', icon: GearSix }
  ];
</script>

<aside
  class={cn(
    'flex h-full flex-col border-r border-hairline bg-paper transition-[width] duration-200 ease-out',
    fullWidth ? 'w-screen' : collapsed ? 'w-[64px]' : 'w-[248px]'
  )}
>
  <div class="flex h-14 touch-none items-center gap-2.5 px-4">
    <div class="grid h-7 w-7 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
      <span class="text-sm font-medium">◐</span>
    </div>
    {#if !collapsed}
      <span class="truncate text-sm font-medium text-ink">Crescent</span>
    {/if}
    {#if fullWidth}
      <button
        class="press ml-auto grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        onclick={() => onClose?.()}
        aria-label="Close menu"
      >
        <X class="h-5 w-5" />
      </button>
    {/if}
  </div>

  <nav class="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-1">
    {#each nav as item (item.id)}
      <a
        href={`#${item.id}`}
        class={cn(
          'flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10',
          active === item.id && 'bg-accent/10 text-accent hover:bg-accent/12 hover:text-accent'
        )}
        title={item.label}
        onclick={() => onClose?.()}
      >
        <item.icon class="h-[18px] w-[18px] shrink-0" />
        {#if !collapsed}<span class="truncate">{item.label}</span>{/if}
      </a>
    {/each}

    <!-- Plan: expands to user-defined section groups -->
    <button
      class="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => (planOpen = !planOpen)}
      title="Plan"
    >
      <ChartPieSlice class="h-[18px] w-[18px] shrink-0" />
      {#if !collapsed}
        <span class="truncate">Plan</span>
        <CaretRight class={cn('ml-auto h-4 w-4 transition-transform', planOpen && 'rotate-90')} />
      {/if}
    </button>
    {#if planOpen && !collapsed}
      <div class="space-y-0.5 pb-1" transition:slide={{ duration: 180 }}>
        {#each planGroups as g (g.id)}
          <a
            href={`#plan/${g.id}`}
            class="flex h-8 items-center rounded-control pl-9 pr-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10"
          >
            <span class="truncate">{g.label}</span>
          </a>
        {/each}
        <button
          class="flex h-8 w-full items-center rounded-control pl-9 pr-2.5 text-sm text-muted/70 transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        >
          <span class="truncate">+ New group</span>
        </button>
      </div>
    {/if}
  </nav>

  <!-- Footer actions: same row layout as nav, so collapsing only hides labels
       (never changes the footer height or shifts the buttons). -->
  <div class="touch-none space-y-0.5 px-2.5 py-2">
    {#each footerNav as item (item.id)}
      <a
        href={`#${item.id}`}
        class="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        title={item.label}
        onclick={() => onClose?.()}
      >
        <item.icon class="h-[18px] w-[18px] shrink-0" />
        {#if !collapsed}<span class="truncate">{item.label}</span>{/if}
      </a>
    {/each}
    <button
      class="press flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => theme.toggle()}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {#if $theme === 'dark'}
        <Sun class="h-[18px] w-[18px] shrink-0" />
      {:else}
        <Moon class="h-[18px] w-[18px] shrink-0" />
      {/if}
      {#if !collapsed}<span class="truncate">{$theme === 'dark' ? 'Light' : 'Dark'}</span>{/if}
    </button>
  </div>

  {#if !fullWidth}
    <!-- Collapse toggle: a fixed single-row bar; only the icon's alignment
         changes between states, so nothing above it ever moves. -->
    <div class="flex touch-none border-t border-hairline px-2.5 py-2">
      <button
        class={cn(
          'press grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10',
          collapsed ? 'mx-auto' : 'ml-auto'
        )}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onclick={() => (collapsed = !collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <CaretRight class={cn('h-4 w-4 transition-transform', !collapsed && 'rotate-180')} />
      </button>
    </div>
  {/if}
</aside>
