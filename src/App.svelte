<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
  import LockScreen from '$lib/components/auth/LockScreen.svelte';
  import { vault } from '$lib/stores/vault';
  import { config } from '$lib/stores/config';

  let collapsed = $state(false);
  let mobileOpen = $state(false);

  const status = $derived($vault.status);

  onMount(() => {
    vault.init();
  });

  // Load the config once the vault is unlocked.
  $effect(() => {
    if (status === 'unlocked') config.load();
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
      <Sidebar active="dashboard" bind:collapsed />
    </div>

    <!-- Mobile drawer (full-width overlay) -->
    {#if mobileOpen}
      <div
        class="fixed inset-0 z-40 h-full w-full overscroll-contain md:hidden"
        transition:fly={{ x: -360, duration: 200, opacity: 1 }}
      >
        <Sidebar active="dashboard" fullWidth onClose={() => (mobileOpen = false)} />
      </div>
    {/if}

    <div class="flex min-w-0 flex-1 flex-col">
      <Topbar title="Dashboard" period="June 2026" onMenu={() => (mobileOpen = true)} />
      <main class={`dashboard-surface flex-1 ${mobileOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <Dashboard />
      </main>
    </div>
  </div>
{/if}
