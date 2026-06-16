<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
  import ImportView from '$lib/components/import/ImportView.svelte';
  import TransactionsView from '$lib/components/transactions/TransactionsView.svelte';
  import RulesView from '$lib/components/rules/RulesView.svelte';
  import MonthlyView from '$lib/components/monthly/MonthlyView.svelte';
  import LockScreen from '$lib/components/auth/LockScreen.svelte';
  import { vault } from '$lib/stores/vault';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';

  let collapsed = $state(false);
  let mobileOpen = $state(false);

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
    <!-- Desktop sidebar (in flow) -->
    <div class="hidden md:block">
      <Sidebar active={route} bind:collapsed />
    </div>

    <!-- Mobile drawer (full-width overlay) -->
    {#if mobileOpen}
      <div
        class="fixed inset-0 z-40 h-full w-full overscroll-contain md:hidden"
        transition:fade={{ duration: 200 }}
      >
        <Sidebar active={route} fullWidth onClose={() => (mobileOpen = false)} />
      </div>
    {/if}

    <div class="flex min-w-0 flex-1 flex-col">
      <Topbar {title} period="June 2026" onMenu={() => (mobileOpen = true)} />
      <main
        class={`dashboard-surface flex-1 ${route === 'transactions' ? 'overflow-hidden' : 'overflow-y-auto'} ${mobileOpen ? 'overflow-hidden' : ''}`}
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
        {:else}
          <Dashboard />
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
