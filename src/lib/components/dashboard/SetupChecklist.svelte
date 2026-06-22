<script lang="ts">
  import { Check, ArrowRight, X } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';

  export interface SetupStep {
    key: string;
    label: string;
    hint: string;
    href: string;
    done: boolean;
  }

  let {
    steps,
    showDemo = false,
    ondismiss,
    onnavigate
  }: {
    steps: SetupStep[];
    showDemo?: boolean;
    ondismiss?: () => void;
    /** Fired when a step link is followed (e.g. to show a "back" affordance). */
    onnavigate?: () => void;
  } = $props();

  const done = $derived(steps.filter((s) => s.done).length);
  const pct = $derived(steps.length ? Math.round((done / steps.length) * 100) : 0);
  // The first not-yet-done step is highlighted as the suggested next action.
  const nextKey = $derived(steps.find((s) => !s.done)?.key);
</script>

<Card class="ring-1 ring-accent/15">
  <div class="mb-4 flex items-start justify-between gap-3">
    <div class="min-w-0">
      <h2 class="text-base font-semibold text-ink">Set up your finances</h2>
      <p class="mt-0.5 text-sm text-muted">
        {#if showDemo}Showing sample figures — {/if}a few steps to make the dashboard reflect your real money.
      </p>
    </div>
    {#if ondismiss}
      <button
        type="button"
        onclick={ondismiss}
        aria-label="Dismiss setup checklist"
        class="press grid h-7 w-7 shrink-0 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink"
      >
        <X class="h-4 w-4" />
      </button>
    {/if}
  </div>

  <div class="mb-4 flex items-center gap-3">
    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
      <div class="h-full rounded-full bg-accent transition-all duration-500" style={`width:${pct}%`}></div>
    </div>
    <span class="shrink-0 text-xs font-medium tabular-nums text-muted">{done} of {steps.length}</span>
  </div>

  <ul class="space-y-1.5">
    {#each steps as s (s.key)}
      <li>
        <a
          href={s.href}
          onclick={() => onnavigate?.()}
          class={`group flex items-center gap-3 rounded-control border p-3 transition-colors ${
            s.done
              ? 'border-hairline'
              : s.key === nextKey
                ? 'border-accent/40 bg-accent/5'
                : 'border-hairline hover:bg-ink/5'
          }`}
        >
          <span
            class={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
              s.done ? 'border-income bg-income text-white' : 'border-hairline text-muted'
            }`}
          >
            {#if s.done}<Check class="h-3.5 w-3.5" weight="bold" />{/if}
          </span>
          <span class="min-w-0 flex-1">
            <span class={`block text-sm font-medium ${s.done ? 'text-muted line-through' : 'text-ink'}`}>{s.label}</span>
            <span class="block truncate text-xs text-muted">{s.hint}</span>
          </span>
          {#if !s.done}
            <ArrowRight class="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
          {/if}
        </a>
      </li>
    {/each}
  </ul>
</Card>
