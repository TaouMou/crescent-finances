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
  <ul class="flex flex-col gap-2.5">
    {#each data as a (a.id)}
      <li class="flex items-center gap-3 rounded-xl bg-warn/8 px-3.5 py-3">
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warn/15 text-warn">
          <Warning class="h-4 w-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-ink">{a.category}</p>
          <p class="mt-0.5 text-xs text-muted">{a.message}</p>
        </div>
        <span class="tnum shrink-0 rounded-full bg-warn/12 px-2.5 py-1 text-xs font-semibold text-warn">
          +{a.deltaPct}%
        </span>
      </li>
    {/each}
  </ul>
{/if}
