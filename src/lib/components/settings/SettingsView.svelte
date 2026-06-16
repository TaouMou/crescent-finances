<script lang="ts">
  import { DownloadSimple, UploadSimple, Check, Plus, Trash, Warning, Sparkle } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
  import { vault } from '$lib/stores/vault';
  import { serializeConfigTemplate, parseConfigTemplate } from '$lib/config/backup';
  import { starterCategories, starterRules } from '$lib/config/schema';
  import type { AppConfig } from '$lib/types';

  let savedAt = $state<string | null>(null);
  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  const txCount = transactions;

  async function patch(mutate: (c: AppConfig) => AppConfig) {
    if (!$config) return;
    await config.save(mutate(structuredClone($config)));
    savedAt = 'Saved';
    setTimeout(() => (savedAt = null), 2000);
  }

  // ----- categories -----
  let newCatName = $state('');
  let newCatColor = $state('#0DA882');

  function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    patch((c) => ({
      ...c,
      categories: [...c.categories, { id: crypto.randomUUID(), name, color: newCatColor, parentId: null }]
    }));
    newCatName = '';
    newCatColor = '#0DA882';
  }

  function updateCategory(id: string, field: 'name' | 'color', value: string) {
    patch((c) => ({
      ...c,
      categories: c.categories.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat))
    }));
  }

  function deleteCategory(id: string) {
    patch((c) => ({ ...c, categories: c.categories.filter((cat) => cat.id !== id) }));
  }

  /** Append any starter categories/rules not already present (idempotent). */
  function addStarterSet() {
    patch((c) => {
      const haveCat = new Set(c.categories.map((cat) => cat.name.toLowerCase()));
      const haveRule = new Set(c.rules.map((r) => r.id));
      return {
        ...c,
        categories: [...c.categories, ...starterCategories().filter((cat) => !haveCat.has(cat.name.toLowerCase()))],
        rules: [...c.rules, ...starterRules().filter((r) => !haveRule.has(r.id))]
      };
    });
  }

  // ----- danger zone -----
  let confirming = $state<null | 'tx' | 'all'>(null);

  async function clearTransactions() {
    await transactions.clearAll();
    confirming = null;
    savedAt = 'Transactions cleared';
    setTimeout(() => (savedAt = null), 2000);
  }

  async function fullReset() {
    confirming = null;
    await vault.reset(); // wipes everything and transitions the app back to setup
  }

  // ----- meta -----
  function setName(v: string) {
    patch((c) => ({ ...c, meta: { ...c.meta, name: v } }));
  }
  function setCurrency(v: string) {
    patch((c) => ({ ...c, meta: { ...c.meta, currency: v } }));
  }
  function setLocale(v: string) {
    patch((c) => ({ ...c, meta: { ...c.meta, locale: v } }));
  }

  // ----- anomaly thresholds (stored only; detection ships in a later update) -----
  function setAnomaly(key: keyof AppConfig['settings']['anomaly'], v: number) {
    patch((c) => ({ ...c, settings: { ...c.settings, anomaly: { ...c.settings.anomaly, [key]: v } } }));
  }

  // ----- config template export / import (plaintext, financial-data-free) -----
  function exportTemplate() {
    if (!$config) return;
    const blob = new Blob([serializeConfigTemplate($config)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crescent-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importTemplate(e: Event) {
    importError = null;
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const parsed = parseConfigTemplate(await file.text());
      await config.save(parsed);
      savedAt = 'Imported';
      setTimeout(() => (savedAt = null), 2000);
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Invalid config file';
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  const inputCls =
    'h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50';
</script>

<div class="mx-auto max-w-[720px] space-y-6 p-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-lg font-semibold text-ink">Settings</h1>
      <p class="mt-0.5 text-sm text-muted">Configuration is financial-data-free and stored in clear.</p>
    </div>
    {#if savedAt}
      <span class="flex items-center gap-1 text-xs text-income"><Check class="h-3.5 w-3.5" /> {savedAt}</span>
    {/if}
  </div>

  <!-- General -->
  <Card>
    <h2 class="card-title mb-4">General</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="flex flex-col gap-1 sm:col-span-2">
        <span class="text-xs text-muted">Configuration name</span>
        <input type="text" value={$config?.meta.name ?? ''} onchange={(e) => setName(e.currentTarget.value)} class={inputCls} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Currency (ISO code)</span>
        <input type="text" value={$config?.meta.currency ?? ''} onchange={(e) => setCurrency(e.currentTarget.value.trim())} placeholder="EUR" class={inputCls} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Locale (BCP-47)</span>
        <input type="text" value={$config?.meta.locale ?? ''} onchange={(e) => setLocale(e.currentTarget.value.trim())} placeholder="en-US" class={inputCls} />
      </label>
    </div>
  </Card>

  <!-- Anomaly thresholds -->
  <Card>
    <h2 class="card-title mb-1">Anomaly detection</h2>
    <p class="mb-4 text-xs text-muted">Flags categories whose spending this month is a robust outlier above their recent baseline. Shown on the dashboard Anomalies card.</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Baseline months</span>
        <input type="number" min="1" value={$config?.settings.anomaly.baselineMonths ?? 6} onchange={(e) => setAnomaly('baselineMonths', Number(e.currentTarget.value))} class={inputCls} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Threshold (%)</span>
        <input type="number" min="0" value={$config?.settings.anomaly.thresholdPct ?? 40} onchange={(e) => setAnomaly('thresholdPct', Number(e.currentTarget.value))} class={inputCls} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Min absolute (minor units)</span>
        <input type="number" min="0" value={$config?.settings.anomaly.minAbsolute ?? 5000} onchange={(e) => setAnomaly('minAbsolute', Number(e.currentTarget.value))} class={inputCls} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">MAD multiplier (k)</span>
        <input type="number" min="0" step="0.1" value={$config?.settings.anomaly.madK ?? 3} onchange={(e) => setAnomaly('madK', Number(e.currentTarget.value))} class={inputCls} />
      </label>
    </div>
  </Card>

  <!-- Categories -->
  <Card>
    <div class="mb-1 flex items-center justify-between gap-2">
      <h2 class="card-title">Categories</h2>
      <button
        class="press flex h-8 items-center gap-1.5 rounded-control border border-hairline px-2.5 text-xs text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        onclick={addStarterSet}
        title="Add a starter set of categories and matching rules"
      >
        <Sparkle class="h-3.5 w-3.5" /> Add starter set
      </button>
    </div>
    <p class="mb-4 text-xs text-muted">
      Categories group your spending. Deleting one leaves its transactions uncategorized.
    </p>

    {#if ($config?.categories ?? []).length > 0}
      <ul class="mb-4 divide-y divide-hairline border-y border-hairline">
        {#each $config?.categories ?? [] as cat (cat.id)}
          <li class="flex items-center gap-2 py-2">
            <input
              type="color"
              value={cat.color}
              onchange={(e) => updateCategory(cat.id, 'color', e.currentTarget.value)}
              class="h-7 w-9 shrink-0 rounded-control border border-hairline bg-surface p-0.5"
              aria-label="Category color"
            />
            <input
              type="text"
              value={cat.name}
              onchange={(e) => updateCategory(cat.id, 'name', e.currentTarget.value.trim())}
              class="h-8 flex-1 rounded-control border border-hairline bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <button
              class="press grid h-8 w-8 shrink-0 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20"
              onclick={() => deleteCategory(cat.id)}
              title="Delete category"
            >
              <Trash class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mb-4 text-sm text-muted">No categories yet — add one below or use the starter set.</p>
    {/if}

    <div class="flex items-center gap-2">
      <input
        type="color"
        bind:value={newCatColor}
        class="h-9 w-10 shrink-0 rounded-control border border-hairline bg-surface p-0.5"
        aria-label="New category color"
      />
      <input
        type="text"
        bind:value={newCatName}
        placeholder="New category name"
        onkeydown={(e) => e.key === 'Enter' && addCategory()}
        class={inputCls + ' flex-1'}
      />
      <button
        class="press flex h-9 items-center gap-1.5 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50"
        onclick={addCategory}
        disabled={!newCatName.trim()}
      >
        <Plus class="h-4 w-4" /> Add
      </button>
    </div>
  </Card>

  <!-- Backup / template -->
  <Card>
    <h2 class="card-title mb-1">Configuration template</h2>
    <p class="mb-4 text-xs text-muted">
      Export or import the configuration as a plaintext, hand-editable JSON template. It contains no
      transactions or balances. Importing replaces the current configuration.
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <button class="press flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={exportTemplate} disabled={!$config}>
        <DownloadSimple class="h-4 w-4" /> Export template
      </button>
      <button class="press flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={() => fileInput.click()}>
        <UploadSimple class="h-4 w-4" /> Import template
      </button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" class="hidden" onchange={importTemplate} />
    </div>
    {#if importError}
      <p class="mt-3 text-xs text-expense">Import failed: {importError}</p>
    {/if}
  </Card>

  <!-- Danger zone -->
  <Card class="border-expense/30">
    <h2 class="card-title mb-1 flex items-center gap-1.5 text-expense"><Warning class="h-4 w-4" /> Danger zone</h2>
    <p class="mb-4 text-xs text-muted">Destructive actions. These cannot be undone.</p>

    <div class="space-y-3">
      <!-- Clear transactions -->
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-hairline p-3">
        <div class="min-w-0">
          <p class="text-sm text-ink">Clear all transactions</p>
          <p class="text-xs text-muted">Deletes every imported transaction. Keeps categories, rules and settings.</p>
        </div>
        {#if confirming === 'tx'}
          <div class="flex items-center gap-2">
            <span class="text-xs text-expense">Delete all {$txCount} transactions?</span>
            <button class="press h-8 rounded-control bg-expense px-3 text-xs font-medium text-white hover:bg-expense/90" onclick={clearTransactions}>Delete</button>
            <button class="press h-8 rounded-control border border-hairline px-3 text-xs text-muted hover:bg-ink/5" onclick={() => (confirming = null)}>Cancel</button>
          </div>
        {:else}
          <button
            class="press h-8 shrink-0 rounded-control border border-expense/30 px-3 text-xs font-medium text-expense hover:bg-expense/10 disabled:opacity-40"
            onclick={() => (confirming = 'tx')}
            disabled={$txCount === 0}
          >
            Clear transactions
          </button>
        {/if}
      </div>

      <!-- Full reset -->
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-hairline p-3">
        <div class="min-w-0">
          <p class="text-sm text-ink">Reset everything</p>
          <p class="text-xs text-muted">Forgets the vault, configuration and passphrase on this device. You'll set up again from scratch.</p>
        </div>
        {#if confirming === 'all'}
          <div class="flex items-center gap-2">
            <span class="text-xs text-expense">Erase everything on this device?</span>
            <button class="press h-8 rounded-control bg-expense px-3 text-xs font-medium text-white hover:bg-expense/90" onclick={fullReset}>Erase</button>
            <button class="press h-8 rounded-control border border-hairline px-3 text-xs text-muted hover:bg-ink/5" onclick={() => (confirming = null)}>Cancel</button>
          </div>
        {:else}
          <button
            class="press h-8 shrink-0 rounded-control border border-expense/30 px-3 text-xs font-medium text-expense hover:bg-expense/10"
            onclick={() => (confirming = 'all')}
          >
            Reset everything
          </button>
        {/if}
      </div>
    </div>
  </Card>
</div>
