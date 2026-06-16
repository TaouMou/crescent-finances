<script lang="ts">
  import { DownloadSimple, UploadSimple, Check } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { config } from '$lib/stores/config';
  import { serializeConfigTemplate, parseConfigTemplate } from '$lib/config/backup';
  import type { AppConfig } from '$lib/types';

  let savedAt = $state<string | null>(null);
  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  async function patch(mutate: (c: AppConfig) => AppConfig) {
    if (!$config) return;
    await config.save(mutate(structuredClone($config)));
    savedAt = 'Saved';
    setTimeout(() => (savedAt = null), 2000);
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
    <p class="mb-4 text-xs text-muted">Thresholds are saved now; automatic detection ships in a later update.</p>
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
</div>
