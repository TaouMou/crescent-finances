<script lang="ts">
  import {
    SquaresFour,
    ArrowsLeftRight,
    CalendarBlank,
    ChartPieSlice,
    UploadSimple,
    GearSix,
    Plus,
    Compass,
    Moon,
    Sun,
    Lock,
    X,
    Funnel
  } from 'phosphor-svelte';
  import { theme } from '$lib/stores/theme';
  import { vault } from '$lib/stores/vault';
  import { config } from '$lib/stores/config';
  import { cn } from '$lib/utils/cn';
  import { Button } from '$lib/components/ui/button';

  let {
    active = 'dashboard',
    showClose = true,
    onClose
  }: {
    active?: string;
    showClose?: boolean;
    onClose?: () => void;
  } = $props();

  const nav = [
    { id: 'start', label: 'Getting started', icon: Compass },
    { id: 'dashboard', label: 'Dashboard', icon: SquaresFour },
    { id: 'transactions', label: 'Transactions', icon: ArrowsLeftRight },
    { id: 'monthly', label: 'Breakdown', icon: CalendarBlank },
    { id: 'rules', label: 'Rules', icon: Funnel }
  ];

  const planGroups = $derived(
    [...($config?.sectionGroups ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((g) => ({ key: g.id, label: g.name, href: '#plan' }))
  );

  const footerNav = [
    { id: 'import', label: 'Import CSV', icon: UploadSimple },
    { id: 'settings', label: 'Settings', icon: GearSix }
  ];
</script>

<aside class="flex h-full w-[280px] flex-col border-r border-hairline bg-paper">
  <div class="flex h-14 touch-none items-center justify-between gap-2.5 px-4">
    <div class="flex items-center gap-2">
      <div class="grid h-7 w-7 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
        <Moon class="h-[15px] w-[15px]" weight="fill" />
      </div>
      <span class="truncate bg-gradient-to-r from-accent to-accent/60 bg-clip-text text-base font-bold tracking-tight text-transparent">Crescent</span>
    </div>
    {#if showClose}
      <Button
        variant="ghost"
        size="icon"
        class="text-muted hover:text-ink"
        onclick={() => onClose?.()}
        aria-label="Close sidebar"
      >
        <X class="h-5 w-5" />
      </Button>
    {/if}
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

    <!-- Planning section: the label is the heading; budgets are the entries,
         and the trailing + opens the Plan page to add one (no surprise modal). -->
    <div class="flex items-center justify-between gap-1 px-2.5 pb-1 pt-3">
      <span
        class={cn(
          'text-[10px] font-semibold uppercase tracking-widest transition-colors',
          active === 'plan' ? 'text-accent' : 'text-muted/50'
        )}
      >
        Planning
      </span>
      <a
        href="#plan"
        class="press grid h-5 w-5 place-items-center rounded text-muted/60 transition-colors hover:bg-ink/5 hover:text-ink"
        title="New budget"
        aria-label="New budget"
        onclick={() => onClose?.()}
      >
        <Plus class="h-3.5 w-3.5" />
      </a>
    </div>
    {#each planGroups as g (g.key)}
      <a
        href={g.href}
        class={cn(
          'flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10',
          active === 'plan' ? 'text-ink' : 'text-muted'
        )}
        title={g.label}
        onclick={() => onClose?.()}
      >
        <ChartPieSlice class="h-[18px] w-[18px] shrink-0 opacity-70" />
        <span class="truncate">{g.label}</span>
      </a>
    {/each}
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
