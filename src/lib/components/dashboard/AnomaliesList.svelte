<script lang="ts">
  import { Warning, Check } from 'phosphor-svelte';
  import type { AnomalyFlag } from '$lib/seed/dashboard';

  let { data }: { data: AnomalyFlag[] } = $props();
</script>

{#if data.length === 0}
  <div class="flex flex-col items-center gap-2 py-8 text-center">
    <div class="grid h-9 w-9 place-items-center rounded-full bg-income/12 text-income">
      <Check class="h-5 w-5" />
    </div>
    <p class="text-sm text-muted">Nothing unusual this period.</p>
  </div>
{:else}
  <ul class="divide-y divide-hairline">
    {#each data as a (a.id)}
      <li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        <span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-warn/12 text-warn">
          <Warning class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <p class="text-sm text-ink">{a.message}</p>
          <p class="text-xs text-muted">{a.category}</p>
        </div>
        <span class="tnum ml-auto text-sm font-medium text-warn">+{a.deltaPct}%</span>
      </li>
    {/each}
  </ul>
{/if}
