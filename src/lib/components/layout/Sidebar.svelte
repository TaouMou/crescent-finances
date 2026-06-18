<script lang="ts">
  import {
    SquaresFour,
    ArrowsLeftRight,
    CalendarBlank,
    ChartPieSlice,
    UploadSimple,
    GearSix,
    CaretRight,
    Moon,
    Sun,
    Lock,
    X,
    Funnel
  } from 'phosphor-svelte';
  import { slide } from 'svelte/transition';
  import { theme } from '$lib/stores/theme';
  import { vault } from '$lib/stores/vault';
  import { config } from '$lib/stores/config';
  import { openNewGroupRequested } from '$lib/stores/plan-ui';
  import { cn } from '$lib/utils/cn';

  let {
    active = 'dashboard',
    onClose
  }: {
    active?: string;
    onClose?: () => void;
  } = $props();

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: SquaresFour },
    { id: 'transactions', label: 'Transactions', icon: ArrowsLeftRight },
    { id: 'monthly', label: 'Breakdown', icon: CalendarBlank },
    { id: 'rules', label: 'Rules', icon: Funnel }
  ];

  let planOpen = $state(true);
  const planGroups = $derived(
    [...($config?.sectionGroups ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ key: g.id, label: g.name, href: '#plan' }))
  );

  function requestNewGroup() {
    openNewGroupRequested.set(true);
    location.hash = '#plan';
    onClose?.();
  }

  const footerNav = [
    { id: 'import', label: 'Import CSV', icon: UploadSimple },
    { id: 'settings', label: 'Settings', icon: GearSix }
  ];
</script>

<aside class="flex h-full w-[280px] flex-col border-r border-hairline bg-paper">
  <div class="flex h-14 touch-none items-center justify-between gap-2.5 px-4">
    <div class="flex items-center gap-2.5">
      <div class="grid h-7 w-7 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
        <span class="text-sm font-medium">◐</span>
      </div>
      <span class="truncate text-sm font-medium text-ink">Crescent</span>
    </div>
    <button
      class="press grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => onClose?.()}
      aria-label="Close sidebar"
    >
      <X class="h-5 w-5" />
    </button>
  </div>

  <nav class="flex-1 touch-pan-y space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-1">
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
        <span class="truncate">{item.label}</span>
      </a>
    {/each}

    <!-- Plan: expands to user-defined section groups -->
    <button
      class="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => (planOpen = !planOpen)}
      title="Plan"
    >
      <ChartPieSlice class="h-[18px] w-[18px] shrink-0" />
      <span class="truncate">Plan</span>
      <CaretRight class={cn('ml-auto h-4 w-4 transition-transform', planOpen && 'rotate-90')} />
    </button>
    {#if planOpen}
      <div class="space-y-0.5 pb-1" transition:slide={{ duration: 180 }}>
        {#each planGroups as g (g.key)}
          <a
            href={g.href}
            class="flex h-8 items-center rounded-control pl-9 pr-2.5 text-sm text-muted transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10"
            onclick={() => onClose?.()}
          >
            <span class="truncate">{g.label}</span>
          </a>
        {/each}
        <button
          class="flex h-8 w-full items-center rounded-control pl-9 pr-2.5 text-sm text-muted/70 transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10"
          onclick={requestNewGroup}
        >
          <span class="truncate">+ New budget</span>
        </button>
      </div>
    {/if}
  </nav>

  <!-- Footer actions -->
  <div class="touch-none space-y-0.5 px-2.5 py-2">
    {#each footerNav as item (item.id)}
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
        <span class="truncate">{item.label}</span>
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
      <span class="truncate">{$theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
    <button
      class="press flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
      onclick={() => { onClose?.(); vault.lock(); }}
      title="Lock"
      aria-label="Lock"
    >
      <Lock class="h-[18px] w-[18px] shrink-0" />
      <span class="truncate">Lock</span>
    </button>
  </div>
</aside>
