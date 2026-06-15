<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Topbar from '$lib/components/layout/Topbar.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';

  let collapsed = $state(false);
  let mobileOpen = $state(false);
</script>

<div class="flex h-screen w-screen overflow-hidden bg-paper text-ink">
  <!-- Desktop sidebar (in flow) -->
  <div class="hidden md:block">
    <Sidebar active="dashboard" bind:collapsed />
  </div>

  <!-- Mobile drawer -->
  {#if mobileOpen}
    <div class="fixed inset-0 z-40 md:hidden">
      <button
        class="absolute inset-0 bg-ink/40"
        aria-label="Close menu"
        transition:fade={{ duration: 150 }}
        onclick={() => (mobileOpen = false)}
      ></button>
      <div class="absolute left-0 top-0 h-full" transition:fly={{ x: -260, duration: 200, opacity: 1 }}>
        <Sidebar active="dashboard" />
      </div>
    </div>
  {/if}

  <div class="flex min-w-0 flex-1 flex-col">
    <Topbar title="Dashboard" period="June 2026" onMenu={() => (mobileOpen = true)} />
    <main class="flex-1 overflow-y-auto">
      <Dashboard />
    </main>
  </div>
</div>
