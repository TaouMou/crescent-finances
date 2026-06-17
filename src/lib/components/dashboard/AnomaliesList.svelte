<script lang="ts">
  import { Warning, Check } from 'phosphor-svelte';
  import type { AnomalyFlag } from '$lib/seed/dashboard';

  let { data }: { data: AnomalyFlag[] } = $props();
</script>

{#if data.length === 0}
  <div class="flex flex-col items-center gap-3 py-10 text-center">
    <div class="grid h-10 w-10 place-items-center rounded-full bg-income/12 text-income">
      <Check class="h-5 w-5" />
    </div>
    <p class="text-sm text-muted">Nothing unusual this period.</p>
  </div>
{:else}
  <ul class="divide-y divide-hairline">
    {#each data as a (a.id)}
      <li class="flex items-center gap-3 py-2.5">
        <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warn/15 text-warn">
          <Warning class="h-3.5 w-3.5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-ink">{a.category}</p>
          <p class="text-xs text-muted">{a.message}</p>
        </div>
        <span class="tnum shrink-0 text-xs font-semibold text-warn">+{a.deltaPct}%</span>
      </li>
    {/each}
  </ul>
{/if}
