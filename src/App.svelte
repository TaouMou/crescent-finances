<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import RightSidebar from '$lib/components/layout/RightSidebar.svelte';
  import LockScreen from '$lib/components/auth/LockScreen.svelte';
  import { vault } from '$lib/stores/vault';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
  import { balances } from '$lib/stores/balances';
  import { returnToStart } from '$lib/stores/start-ui';
  import { ArrowLeft, X } from 'phosphor-svelte';
  import { monthsDaysBetween, formatSpan, isSameDay, toISODate } from '$lib/utils/dates';

  let sidebarOpen = $state(false);
  let rightOpen = $state(false);

  // Date range state for the dashboard (shared with Topbar and Dashboard)
  const _today = new Date();
  const _aYearAgo = new Date(_today);
  _aYearAgo.setFullYear(_today.getFullYear() - 1);
  let fromStr = $state(toISODate(_aYearAgo));
  let toStr = $state(toISODate(_today));

  const spanLabel = $derived.by(() => {
    const fromDate = new Date(`${fromStr}T00:00:00`);
    const toDate = new Date(`${toStr}T23:59:59`);
    const { months, days } = monthsDaysBetween(fromDate, toDate);
    const span = formatSpan(months, days);
    return isSameDay(toDate, _today) ? `Last ${span}` : span;
  });

  const status = $derived($vault.status);
  const devBypass = import.meta.env.VITE_DEV_BYPASS === 'true';

  // ----- hash router -----
  let route = $state(currentRoute());

  function currentRoute(): string {
    return (typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '') || 'dashboard';
  }

  // ----- lazy-loaded route views -----
  // Each view is its own dynamic import so Vite emits a separate chunk; only the
  // active route's JS is fetched + parsed. Heavy views (Settings, Plan, Import,
  // all charts) no longer sit on the first-paint path. The shell (Sidebar, Topbar,
  // RightSidebar, LockScreen) stays eager since it renders on every route.
  const viewLoaders: Record<string, () => Promise<{ default: Component }>> = {
    start: () => import('$lib/components/start/StartView.svelte'),
    import: () => import('$lib/components/import/ImportView.svelte'),
    transactions: () => import('$lib/components/transactions/TransactionsView.svelte'),
    rules: () => import('$lib/components/rules/RulesView.svelte'),
    monthly: () => import('$lib/components/monthly/MonthlyView.svelte'),
    plan: () => import('$lib/components/plan/PlanView.svelte'),
    settings: () => import('$lib/components/settings/SettingsView.svelte'),
    dashboard: () => import('$lib/components/dashboard/Dashboard.svelte')
  };
  const viewCache = new Map<string, Component>();
  let View = $state<Component | null>(null);
  let viewRoute = $state('dashboard');

  // Resolve the active route to a component. Already-visited views swap in
  // synchronously (cached); first visits keep the previous view mounted until the
  // chunk resolves, so navigation never flashes a blank pane.
  $effect(() => {
    const target = viewLoaders[route] ? route : 'dashboard';
    const cached = viewCache.get(target);
    if (cached) {
      View = cached;
      viewRoute = target;
      return;
    }
    let active = true;
    viewLoaders[target]().then((m) => {
      viewCache.set(target, m.default);
      if (active) {
        View = m.default;
        viewRoute = target;
      }
    });
    return () => {
      active = false;
    };
  });

  const titles: Record<string, string> = {
    start: 'Getting started',
    dashboard: 'Dashboard',
    import: 'Import',
    transactions: 'Transactions',
    rules: 'Rules',
    monthly: 'Monthly',
    plan: 'Plan',
    settings: 'Settings'
  };
  const title = $derived(titles[route] ?? 'Dashboard');

  function navigate(newRoute: string) {
    if (newRoute === route) return;
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(
        () => {
          route = newRoute;
        }
      );
    } else {
      route = newRoute;
    }
  }

  onMount(() => {
    vault.init();

    const onHash = () => navigate(currentRoute());
    window.addEventListener('hashchange', onHash);

    return () => window.removeEventListener('hashchange', onHash);
  });

  // Load config + transactions once unlocked; reset cache on lock.
  // On the very first unlock on this device, send the user to the Getting-started
  // page once (tracked in localStorage). It stays reachable from the sidebar after.
  let onboardChecked = false;
  $effect(() => {
    if (status === 'unlocked') {
      config.load();
      transactions.loadAll();
      balances.load();
      if (!onboardChecked) {
        onboardChecked = true;
        maybeRedirectToStart();
      }
    } else if (status === 'locked') {
      transactions.reset();
      balances.reset();
    }
  });

  // Clear the "back to start" affordance once the user is back on the page.
  $effect(() => {
    if (route === 'start') returnToStart.set(false);
  });

  function maybeRedirectToStart() {
    try {
      if (localStorage.getItem('crescent.onboarded') === '1') return;
      // Mark immediately so we only ever auto-redirect once, never in a loop.
      localStorage.setItem('crescent.onboarded', '1');
    } catch {
      return; // storage disabled — don't auto-redirect
    }
    // Only when landing on the default route; respect any explicit deep link.
    if (currentRoute() === 'dashboard') {
      location.hash = 'start';
    }
  }
</script>

{#if status === 'loading'}
  <div class="flex h-screen w-screen items-center justify-center bg-paper text-muted" out:fade={{ duration: 150 }}>
    <span class="text-sm">Loading…</span>
  </div>
{:else if !devBypass && status === 'uninitialized'}
  <LockScreen firstRun />
{:else if !devBypass && (status === 'locked' || status === 'unlocking')}
  <LockScreen />
{:else}
  <div class="flex h-[100dvh] w-screen overflow-hidden bg-paper text-ink" in:fade={{ duration: 150 }}>
    <!-- Persistent nav rail (desktop) -->
    <div class="hidden shrink-0 lg:block">
      <Sidebar active={route} showClose={false} />
    </div>

    <!-- Left sidebar overlay (mobile) -->
    {#if sidebarOpen}
      <button
        class="fixed inset-0 z-40 w-full bg-black/40 lg:hidden"
        transition:fade={{ duration: 200 }}
        onclick={() => (sidebarOpen = false)}
        aria-label="Close menu"
      ></button>
      <div
        class="fixed inset-y-0 left-0 z-50 overscroll-contain lg:hidden"
        transition:fly={{ x: -280, duration: 250, easing: cubicOut }}
      >
        <Sidebar active={route} onClose={() => (sidebarOpen = false)} />
      </div>
    {/if}

    <!-- Right sidebar overlay -->
    {#if rightOpen}
      <RightSidebar
        {route}
        bind:fromStr
        bind:toStr
        {spanLabel}
        onClose={() => (rightOpen = false)}
      />
    {/if}

    <div class="flex min-w-0 flex-1 flex-col">
      <Topbar
        {title}
        showPanel={route === 'dashboard'}
        onMenu={() => (sidebarOpen = true)}
        onPanel={() => (rightOpen = !rightOpen)}
      />
      {#if $returnToStart && route !== 'start'}
        <div
          class="flex items-center justify-between gap-2 border-b border-accent/20 bg-accent/5 px-4 py-1.5"
          transition:fade={{ duration: 150 }}
        >
          <a
            href="#start"
            class="press flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <ArrowLeft class="h-4 w-4" /> Back to Getting started
          </a>
          <button
            class="press grid h-7 w-7 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink"
            onclick={() => returnToStart.set(false)}
            aria-label="Dismiss"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      {/if}
      <main
        class={`flex-1 touch-pan-y overscroll-y-contain ${route === 'transactions' ? 'overflow-hidden' : 'overflow-y-auto'} ${sidebarOpen || rightOpen ? 'overflow-hidden' : ''}`}
        style="view-transition-name: main-content;"
      >
        {#if View && viewRoute === 'dashboard'}
          <View bind:fromStr bind:toStr {spanLabel} />
        {:else if View}
          <View />
        {:else}
          <div class="flex h-full items-center justify-center text-muted">
            <span class="text-sm">Loading…</span>
          </div>
        {/if}
      </main>
    </div>
  </div>
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    :global(::view-transition-old(main-content)) {
      animation: 150ms ease-out both fade-out;
    }
    :global(::view-transition-new(main-content)) {
      animation: 200ms ease-in both fade-in;
    }
    @keyframes fade-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  }
</style>
