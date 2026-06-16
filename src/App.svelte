<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
  import ImportView from '$lib/components/import/ImportView.svelte';
  import LockScreen from '$lib/components/auth/LockScreen.svelte';
  import { vault } from '$lib/stores/vault';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';

  let collapsed = $state(false);
  let mobileOpen = $state(false);

  const status = $derived($vault.status);

  // Minimal hash routing (a precursor to the M3 router): map #import etc. to a
  // view; everything else falls back to the dashboard.
  let route = $state(currentRoute());
  function currentRoute(): string {
    return (typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '') || 'dashboard';
  }

  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    import: 'Import',
    transactions: 'Transactions'
  };
  const title = $derived(titles[route] ?? 'Dashboard');

  onMount(() => {
    vault.init();
    const onHash = () => (route = currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  // Load the config + transaction count once the vault is unlocked.
  $effect(() => {
    if (status === 'unlocked') {
      config.load();
      transactions.refreshCount();
    }
  });
</script>

{#if status === 'loading'}
  <div class="flex h-screen w-screen items-center justify-center bg-paper text-muted" out:fade={{ duration: 150 }}>
    <span class="text-sm">Loading…</span>
  </div>
{:else if status === 'uninitialized'}
  <LockScreen firstRun />
{:else if status === 'locked' || status === 'unlocking'}
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
        transition:fly={{ x: -360, duration: 200, opacity: 1 }}
      >
        <Sidebar active={route} fullWidth onClose={() => (mobileOpen = false)} />
      </div>
    {/if}

    <div class="flex min-w-0 flex-1 flex-col">
      <Topbar {title} period="June 2026" onMenu={() => (mobileOpen = true)} />
      <main class={`dashboard-surface flex-1 ${mobileOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {#if route === 'import'}
          <ImportView />
        {:else}
          <Dashboard />
        {/if}
      </main>
    </div>
  </div>
{/if}
