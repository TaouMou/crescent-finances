<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import RightSidebar from '$lib/components/layout/RightSidebar.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
  import ImportView from '$lib/components/import/ImportView.svelte';
  import TransactionsView from '$lib/components/transactions/TransactionsView.svelte';
  import RulesView from '$lib/components/rules/RulesView.svelte';
  import MonthlyView from '$lib/components/monthly/MonthlyView.svelte';
  import PlanView from '$lib/components/plan/PlanView.svelte';
  import SettingsView from '$lib/components/settings/SettingsView.svelte';
  import LockScreen from '$lib/components/auth/LockScreen.svelte';
  import { vault } from '$lib/stores/vault';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
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

  const titles: Record<string, string> = {
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
  $effect(() => {
    if (status === 'unlocked') {
      config.load();
      transactions.loadAll();
    } else if (status === 'locked') {
      transactions.reset();
    }
  });
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
  <div class="flex h-screen w-screen overflow-hidden bg-paper text-ink" in:fade={{ duration: 150 }}>
    <!-- Left sidebar overlay -->
    {#if sidebarOpen}
      <button
        class="fixed inset-0 z-40 w-full bg-black/40"
        transition:fade={{ duration: 200 }}
        onclick={() => (sidebarOpen = false)}
        aria-label="Close menu"
      ></button>
      <div
        class="fixed inset-y-0 left-0 z-50 overscroll-contain"
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
        onMenu={() => (sidebarOpen = true)}
        onPanel={() => (rightOpen = !rightOpen)}
      />
      <main
        class={`flex-1 touch-pan-y overscroll-y-contain ${route === 'transactions' ? 'overflow-hidden' : 'overflow-y-auto'} ${sidebarOpen || rightOpen ? 'overflow-hidden' : ''}`}
        style="view-transition-name: main-content;"
      >
        {#if route === 'import'}
          <ImportView />
        {:else if route === 'transactions'}
          <TransactionsView />
        {:else if route === 'rules'}
          <RulesView />
        {:else if route === 'monthly'}
          <MonthlyView />
        {:else if route === 'plan'}
          <PlanView />
        {:else if route === 'settings'}
          <SettingsView />
        {:else}
          <Dashboard bind:fromStr bind:toStr {spanLabel} />
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
