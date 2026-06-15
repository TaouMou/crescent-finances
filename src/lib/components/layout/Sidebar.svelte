<script lang="ts">
  import {
    LayoutDashboard,
    ArrowLeftRight,
    PieChart,
    Upload,
    Settings,
    ChevronRight,
    Moon,
    Sun
  } from 'lucide-svelte';
  import { slide } from 'svelte/transition';
  import { theme } from '$lib/stores/theme';
  import { cn } from '$lib/utils/cn';

  let { active = 'dashboard', collapsed = $bindable(false) }: { active?: string; collapsed?: boolean } =
    $props();

  // Notion-style nested navigation. "Plan" expands into user-defined section groups.
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight }
  ];

  let planOpen = $state(true);
  // Section groups are user-created; shown here from a demo config.
  const planGroups = [
    { id: 'g1', label: 'Monthly plan' },
    { id: 'g2', label: 'Goals' }
  ];

  const footerNav = [
    { id: 'import', label: 'Import CSV', icon: Upload },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];
</script>

<aside
  class={cn(
    'flex h-full flex-col border-r border-hairline bg-paper transition-[width] duration-200 ease-out',
    collapsed ? 'w-[64px]' : 'w-[248px]'
  )}
>
  <div class="flex h-14 items-center gap-2.5 px-4">
    <div class="grid h-7 w-7 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
      <span class="text-sm font-medium">◐</span>
    </div>
    {#if !collapsed}
      <span class="truncate text-sm font-medium text-ink">Crescent</span>
    {/if}
  </div>

  <nav class="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-1">
    {#each nav as item (item.id)}
      <a
        href={`#${item.id}`}
        class={cn(
          'flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink',
          active === item.id && 'bg-accent/10 text-accent hover:bg-accent/12 hover:text-accent'
        )}
        title={item.label}
      >
        <item.icon class="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        {#if !collapsed}<span class="truncate">{item.label}</span>{/if}
      </a>
    {/each}

    <!-- Plan: expands to user-defined section groups -->
    <button
      class="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink"
      onclick={() => (planOpen = !planOpen)}
      title="Plan"
    >
      <PieChart class="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      {#if !collapsed}
        <span class="truncate">Plan</span>
        <ChevronRight class={cn('ml-auto h-4 w-4 transition-transform', planOpen && 'rotate-90')} />
      {/if}
    </button>
    {#if planOpen && !collapsed}
      <div class="space-y-0.5 pb-1" transition:slide={{ duration: 180 }}>
        {#each planGroups as g (g.id)}
          <a
            href={`#plan/${g.id}`}
            class="flex h-8 items-center rounded-control pl-9 pr-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <span class="truncate">{g.label}</span>
          </a>
        {/each}
        <button
          class="flex h-8 w-full items-center rounded-control pl-9 pr-2.5 text-sm text-muted/70 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <span class="truncate">+ New group</span>
        </button>
      </div>
    {/if}
  </nav>

  <div class="space-y-0.5 px-2.5 py-2">
    {#each footerNav as item (item.id)}
      <a
        href={`#${item.id}`}
        class="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink"
        title={item.label}
      >
        <item.icon class="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        {#if !collapsed}<span class="truncate">{item.label}</span>{/if}
      </a>
    {/each}
  </div>

  <div
    class={cn(
      'flex border-t border-hairline px-2.5 py-2.5',
      collapsed ? 'flex-col items-center gap-1' : 'items-center gap-1'
    )}
  >
    <button
      class={cn(
        'flex h-9 items-center rounded-control text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink',
        collapsed ? 'w-9 justify-center' : 'gap-2.5 px-2.5'
      )}
      onclick={() => theme.toggle()}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {#if $theme === 'dark'}
        <Sun class="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      {:else}
        <Moon class="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      {/if}
      {#if !collapsed}<span class="truncate">{$theme === 'dark' ? 'Light' : 'Dark'}</span>{/if}
    </button>
    <button
      class={cn(
        'grid h-9 w-9 place-items-center rounded-control text-muted transition-colors hover:bg-ink/5 hover:text-ink',
        !collapsed && 'ml-auto'
      )}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onclick={() => (collapsed = !collapsed)}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <ChevronRight class={cn('h-4 w-4 transition-transform', !collapsed && 'rotate-180')} />
    </button>
  </div>
</aside>
