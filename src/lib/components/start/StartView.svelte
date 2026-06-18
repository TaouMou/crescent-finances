<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import SetupChecklist from '$lib/components/dashboard/SetupChecklist.svelte';
  import {
    ShieldCheck,
    FileArrowDown,
    Wallet,
    Tag,
    ArrowRight,
    Check
  } from 'phosphor-svelte';
  import { transactions } from '$lib/stores/transactions';
  import { balances } from '$lib/stores/balances';
  import { config } from '$lib/stores/config';
  import { deriveSetupSteps } from '$lib/onboarding/steps';
  import { planTemplates, type PlanTemplate } from '$lib/sections/templates';
  import { safeParseConfig } from '$lib/config/schema';

  const txCount = transactions;

  $effect(() => {
    transactions.loadAll();
    balances.load();
    config.load();
  });

  const hasData = $derived($txCount > 0);
  const hasBalance = $derived(Object.keys($balances).length > 0);
  const hasPlan = $derived(
    ($config?.sectionGroups?.length ?? 0) > 0 && ($config?.sections?.length ?? 0) > 0
  );
  const hasGoal = $derived(($config?.sections ?? []).some((s) => s.calc?.type === 'target'));

  const steps = $derived(deriveSetupSteps({ hasData, hasBalance, hasPlan, hasGoal }));

  // What the app is, in plain terms — answers "how do I even start?".
  const mentalModel = [
    {
      icon: ShieldCheck,
      title: 'Private by design',
      body: 'Everything stays in this browser, encrypted. No account, no cloud, no one else can read it — so there is no recovery if you forget your passphrase.'
    },
    {
      icon: FileArrowDown,
      title: 'You bring the data',
      body: 'Import a CSV export from your bank (e.g. Boursorama). You decide the date range — a few recent months is plenty to start. You can always import more later; duplicates are skipped.'
    },
    {
      icon: Wallet,
      title: 'Make the balance match your bank',
      body: "You don't need your whole history. Set each account's starting balance and as-of date in Settings; Crescent adds your imported transactions on top, so Liquid balance matches what your bank shows."
    },
    {
      icon: Tag,
      title: 'Categorize once, automatically',
      body: 'Rules tag and categorize transactions for you by matching the description (e.g. anything containing "ALDI" → Groceries). Set them up once and they apply on every import.'
    }
  ];

  // Apply a recipe to the config, then jump to the Plan page to see it.
  let applying = $state(false);
  let appliedId = $state<string | null>(null);

  async function applyRecipe(t: PlanTemplate) {
    if (!$config || applying) return;
    const built = t.build();
    const next = {
      ...$config,
      sectionGroups: [...$config.sectionGroups, ...built.sectionGroups],
      sections: [...$config.sections, ...built.sections]
    };
    const parsed = safeParseConfig(next);
    if (!parsed.success) {
      console.error('Invalid recipe config', parsed.error);
      return;
    }
    applying = true;
    await config.save(next);
    applying = false;
    appliedId = t.id;
    location.hash = '#plan';
  }
</script>

<div class="mx-auto max-w-[860px] space-y-6 p-6">
  <!-- Header -->
  <div class="space-y-1.5">
    <h1 class="text-xl font-semibold text-ink">Getting started</h1>
    <p class="text-sm text-muted">
      A quick tour of how Crescent works and a few one-click setups to copy. You can reopen this
      page any time from the sidebar.
    </p>
  </div>

  <!-- 1. Mental model -->
  <section class="space-y-3">
    <h2 class="card-title">How it works</h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each mentalModel as m (m.title)}
        <Card>
          <div class="flex gap-3">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent/10 text-accent">
              <m.icon class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-ink">{m.title}</h3>
              <p class="mt-1 text-sm text-muted">{m.body}</p>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  </section>

  <!-- 2. First 15 minutes -->
  <section class="space-y-3">
    <h2 class="card-title">Your first 15 minutes</h2>
    <SetupChecklist {steps} />
  </section>

  <!-- 3. Recipe gallery -->
  <section class="space-y-3">
    <div class="space-y-1">
      <h2 class="card-title">Use-case recipes</h2>
      <p class="text-sm text-muted">
        Not sure how to arrange your plan? Apply one of these and tweak it on the Plan page. A
        common setup: salary comes in, expenses go out, and what's left is split into Savings,
        Investment and Charity.
      </p>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each planTemplates as t (t.id)}
        <Card>
          <div class="flex h-full flex-col">
            <h3 class="text-sm font-semibold text-ink">{t.title}</h3>
            <p class="mt-1 flex-1 text-sm text-muted">{t.description}</p>
            <button
              type="button"
              onclick={() => applyRecipe(t)}
              disabled={applying || !$config}
              class="press mt-3 flex h-9 items-center justify-center gap-2 self-start rounded-control border border-hairline px-3 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              {#if appliedId === t.id}
                <Check class="h-4 w-4 text-income" /> Applied
              {:else}
                Use this recipe <ArrowRight class="h-4 w-4" />
              {/if}
            </button>
          </div>
        </Card>
      {/each}
    </div>
  </section>
</div>
