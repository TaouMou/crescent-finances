<script lang="ts">
  import { UploadSimple, FileCsv, CheckCircle, ArrowLeft, Warning } from 'phosphor-svelte';
  import { cryptoWorker } from '$lib/workers/cryptoClient';
  import { transactions } from '$lib/stores/transactions';
  import { config } from '$lib/stores/config';
  import { rowsToRecords, type ParseResult } from '$lib/import/csv';
  import { guessMapping, defaultsForDelimiter } from '$lib/import/guess';
  import { applyRules } from '$lib/rules/engine';
  import { suggestCategories } from '$lib/rules/suggest';
  import type { BuildResult } from '$lib/import/transactions';
  import type { ImportProfile } from '$lib/types';
  import { formatMoney } from '$lib/utils/currency';
  import Card from '$lib/components/ui/Card.svelte';
  import { cn } from '$lib/utils/cn';

  type Step = 'select' | 'mapping' | 'done';
  let step = $state<Step>('select');
  let busy = $state(false);
  let errorMsg = $state<string | null>(null);

  let parsed = $state<ParseResult | null>(null);
  let rawBytes: ArrayBuffer | null = null;

  // Mapping + parse settings (bound to the form controls).
  let amountMode = $state<'single' | 'split'>('split');
  let mapDate = $state('');
  let mapLabel = $state('');
  let mapAmount = $state('');
  let mapDebit = $state('');
  let mapCredit = $state('');
  let mapAccountCol = $state('');
  let defaultAccountId = $state<string | null>(null);
  let dateFormat = $state('dd/MM/yyyy');
  let decimal = $state(',');
  let thousands = $state('.');

  let preview = $state<BuildResult | null>(null);
  let result = $state<{ added: number; duplicates: number } | null>(null);

  // Inferred categories for rows no rule already categorized (txId -> categoryId).
  let suggestions = $state<Map<string, string>>(new Map());
  // Suggestions the user has dismissed.
  let rejected = $state<Set<string>>(new Set());

  const categoryName = (id: string) => $config?.categories.find((c) => c.id === id)?.name ?? null;
  const suggestionCount = $derived([...suggestions.keys()].filter((id) => !rejected.has(id)).length);

  // Profiles + save-as.
  let selectedProfileId = $state('');
  let saveProfile = $state(false);
  let newProfileName = $state('');

  const accounts = $derived($config?.accounts ?? []);
  const profiles = $derived($config?.importProfiles ?? []);
  const currency = $derived($config?.meta.currency ?? 'EUR');
  const locale = $derived($config?.meta.locale ?? 'en-US');

  const mappingComplete = $derived(
    mapDate !== '' &&
      mapLabel !== '' &&
      (amountMode === 'single' ? mapAmount !== '' : mapDebit !== '' || mapCredit !== '')
  );

  async function parseBytes(bytes: ArrayBuffer, opts: { hasHeader?: boolean } = {}) {
    busy = true;
    errorMsg = null;
    try {
      const res = await cryptoWorker.parse(bytes, opts);
      parsed = res;
      rawBytes = bytes;
      applyDefaults(res);
      step = 'mapping';
      await rebuildPreview();
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Could not read that file.';
    } finally {
      busy = false;
    }
  }

  function applyDefaults(res: ParseResult) {
    const d = defaultsForDelimiter(res.delimiter);
    dateFormat = d.dateFormat;
    decimal = d.numberFormat.decimal;
    thousands = d.numberFormat.thousands;
    const g = guessMapping(res.headers);
    mapDate = g.date ?? '';
    mapLabel = g.label ?? '';
    mapDebit = g.debit ?? '';
    mapCredit = g.credit ?? '';
    mapAmount = g.amount ?? '';
    amountMode = g.debit || g.credit ? 'split' : g.amount ? 'single' : 'split';
    mapAccountCol = '';
    defaultAccountId = accounts[0]?.id ?? null;
  }

  async function onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await parseBytes(await file.arrayBuffer());
  }

  async function loadSample() {
    busy = true;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample.csv`);
      await parseBytes(await res.arrayBuffer());
    } catch {
      errorMsg = 'Could not load the sample file.';
      busy = false;
    }
  }

  function currentMapping(): ImportProfile['mapping'] {
    return {
      date: mapDate,
      label: mapLabel,
      ...(amountMode === 'single' ? { amount: mapAmount } : { debit: mapDebit, credit: mapCredit }),
      ...(mapAccountCol ? { account: mapAccountCol } : {})
    };
  }

  async function rebuildPreview() {
    if (!parsed || !mappingComplete) {
      preview = null;
      return;
    }
    const records = rowsToRecords(parsed.rows, parsed.headers);
    preview = await cryptoWorker.buildTransactions(records, {
      mapping: currentMapping(),
      dateFormat,
      numberFormat: { decimal, thousands },
      accountId: defaultAccountId,
      source: 'csv-import'
    });
    await computeSuggestions();
  }

  /**
   * Suggest categories for rows that no rule already categorizes, learned from
   * previously imported transactions. Runs after the preview is (re)built.
   */
  async function computeSuggestions() {
    suggestions = new Map();
    rejected = new Set();
    if (!preview || preview.transactions.length === 0) return;
    const rules = $config?.rules ?? [];
    const snap = $state.snapshot(preview.transactions);
    const afterRules = rules.length ? applyRules(snap, rules) : snap;
    const history = await transactions.loadAll();
    suggestions = suggestCategories(afterRules, history);
  }

  function applyProfile(id: string) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    dateFormat = p.dateFormat;
    decimal = p.decimal;
    thousands = p.thousands;
    mapDate = p.mapping.date;
    mapLabel = p.mapping.label;
    mapAmount = p.mapping.amount ?? '';
    mapDebit = p.mapping.debit ?? '';
    mapCredit = p.mapping.credit ?? '';
    mapAccountCol = p.mapping.account ?? '';
    amountMode = p.mapping.amount ? 'single' : 'split';
    defaultAccountId = p.accountId;
    rebuildPreview();
  }

  async function toggleHeader() {
    if (!rawBytes || !parsed) return;
    await parseBytes(rawBytes, { hasHeader: !parsed.hasHeader });
  }

  async function commit() {
    if (!preview || preview.transactions.length === 0) return;
    busy = true;
    errorMsg = null;
    try {
      // $state proxies can't be structured-cloned to the worker — snapshot first.
      // Pre-fill accepted suggestions; commit's rule pass still takes precedence
      // (rules only overwrite on match, so suggestions only fill the gaps).
      const snap = $state.snapshot(preview.transactions).map((tx) => {
        const sug = suggestions.get(tx.id);
        return sug && !rejected.has(tx.id) ? { ...tx, categoryId: sug } : tx;
      });
      result = await transactions.commit(snap, $config);
      if (saveProfile && newProfileName.trim() && parsed && $config) {
        const profile: ImportProfile = {
          id: crypto.randomUUID(),
          name: newProfileName.trim(),
          delimiter: parsed.delimiter,
          encoding: parsed.encoding,
          hasHeader: parsed.hasHeader,
          dateFormat,
          decimal,
          thousands,
          mapping: currentMapping(),
          accountId: defaultAccountId
        };
        await config.save({ ...$config, importProfiles: [...$config.importProfiles, profile] });
      }
      step = 'done';
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Import failed.';
    } finally {
      busy = false;
    }
  }

  function reset() {
    step = 'select';
    parsed = null;
    rawBytes = null;
    preview = null;
    result = null;
    suggestions = new Map();
    rejected = new Set();
    selectedProfileId = '';
    saveProfile = false;
    newProfileName = '';
  }
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
  <header class="mb-6">
    <h1 class="text-xl font-medium tracking-tight text-ink">Import transactions</h1>
    <p class="mt-1 text-sm text-muted">Bring in a CSV export from your bank. Nothing leaves your device.</p>
  </header>

  {#if errorMsg}
    <div class="mb-4 flex items-center gap-2 rounded-control border border-expense/30 bg-expense/5 px-3 py-2 text-sm text-expense">
      <Warning size={16} weight="fill" />{errorMsg}
    </div>
  {/if}

  {#if step === 'select'}
    <Card>
      <div class="flex flex-col items-center gap-4 py-8 text-center">
        <div class="grid h-12 w-12 place-items-center rounded-control bg-accent/10 text-accent">
          <UploadSimple size={24} />
        </div>
        <div>
          <p class="text-sm text-ink">Choose a CSV file to import</p>
          <p class="mt-1 text-xs text-muted">Delimiter and encoding are detected automatically.</p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <label class="press cursor-pointer rounded-control bg-accent px-4 py-2 text-sm font-medium text-white">
            Choose file
            <input type="file" accept=".csv,text/csv" class="hidden" onchange={onFile} />
          </label>
          <button
            class="press rounded-control border border-hairline bg-surface px-4 py-2 text-sm text-ink hover:bg-ink/5"
            onclick={loadSample}
            disabled={busy}
          >
            Use sample.csv
          </button>
        </div>
      </div>
    </Card>
  {/if}

  {#if step === 'mapping' && parsed}
    <Card>
      <!-- Detection summary -->
      <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span class="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-1"><FileCsv size={14} /> {parsed.totalRows} rows</span>
        <span class="rounded-full bg-ink/5 px-2 py-1">Delimiter “{parsed.delimiter}”</span>
        <span class="rounded-full bg-ink/5 px-2 py-1">{parsed.encoding}</span>
        <button class="press rounded-full bg-ink/5 px-2 py-1 hover:bg-ink/10" onclick={toggleHeader}>
          {parsed.hasHeader ? 'Has header row' : 'No header row'} · toggle
        </button>
      </div>

      {#if profiles.length}
        <label class="mb-4 block">
          <span class="mb-1 block text-xs font-medium text-muted">Reuse a saved profile</span>
          <select
            class="field"
            bind:value={selectedProfileId}
            onchange={() => selectedProfileId && applyProfile(selectedProfileId)}
          >
            <option value="">Manual mapping…</option>
            {#each profiles as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
          </select>
        </label>
      {/if}

      <!-- Mapping controls -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="lbl">Date column</span>
          <select class="field" bind:value={mapDate} onchange={rebuildPreview}>
            <option value="">—</option>
            {#each parsed.headers as h (h)}<option value={h}>{h}</option>{/each}
          </select>
        </label>
        <label class="block">
          <span class="lbl">Label column</span>
          <select class="field" bind:value={mapLabel} onchange={rebuildPreview}>
            <option value="">—</option>
            {#each parsed.headers as h (h)}<option value={h}>{h}</option>{/each}
          </select>
        </label>

        <div class="sm:col-span-2">
          <span class="lbl">Amount</span>
          <div class="mb-2 inline-flex rounded-control border border-hairline p-0.5 text-xs">
            <button
              class={cn('press rounded-[4px] px-3 py-1', amountMode === 'split' ? 'bg-accent/10 text-accent' : 'text-muted')}
              onclick={() => { amountMode = 'split'; rebuildPreview(); }}
            >Debit / Credit</button>
            <button
              class={cn('press rounded-[4px] px-3 py-1', amountMode === 'single' ? 'bg-accent/10 text-accent' : 'text-muted')}
              onclick={() => { amountMode = 'single'; rebuildPreview(); }}
            >Single column</button>
          </div>
          {#if amountMode === 'single'}
            <select class="field" bind:value={mapAmount} onchange={rebuildPreview}>
              <option value="">—</option>
              {#each parsed.headers as h (h)}<option value={h}>{h}</option>{/each}
            </select>
          {:else}
            <div class="grid grid-cols-2 gap-3">
              <select class="field" bind:value={mapDebit} onchange={rebuildPreview}>
                <option value="">Debit —</option>
                {#each parsed.headers as h (h)}<option value={h}>{h}</option>{/each}
              </select>
              <select class="field" bind:value={mapCredit} onchange={rebuildPreview}>
                <option value="">Credit —</option>
                {#each parsed.headers as h (h)}<option value={h}>{h}</option>{/each}
              </select>
            </div>
          {/if}
        </div>

        <label class="block">
          <span class="lbl">Account</span>
          <select class="field" bind:value={defaultAccountId} onchange={rebuildPreview}>
            {#if accounts.length === 0}<option value={null}>No accounts yet</option>{/if}
            {#each accounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
          </select>
        </label>
        <label class="block">
          <span class="lbl">Date format</span>
          <input class="field" bind:value={dateFormat} onchange={rebuildPreview} placeholder="dd/MM/yyyy" />
        </label>
        <label class="block">
          <span class="lbl">Decimal separator</span>
          <input class="field" bind:value={decimal} onchange={rebuildPreview} maxlength="1" />
        </label>
        <label class="block">
          <span class="lbl">Thousands separator</span>
          <input class="field" bind:value={thousands} onchange={rebuildPreview} maxlength="1" />
        </label>
      </div>

      <!-- Preview -->
      {#if preview}
        <div class="mt-5">
          <div class="mb-2 flex items-center justify-between text-xs text-muted">
            <span>Preview{#if suggestionCount > 0} · {suggestionCount} auto-categorized{/if}</span>
            <span>
              {preview.transactions.length} valid{#if preview.errors.length}, {preview.errors.length} skipped{/if}
            </span>
          </div>
          <div class="overflow-hidden rounded-control border border-hairline">
            <table class="w-full text-sm">
              <thead class="bg-ink/5 text-xs text-muted">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">Date</th>
                  <th class="px-3 py-2 text-left font-medium">Label</th>
                  <th class="px-3 py-2 text-left font-medium">Category</th>
                  <th class="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each preview.transactions.slice(0, 8) as tx (tx.id)}
                  <tr class="border-t border-hairline">
                    <td class="px-3 py-2 tnum text-muted">{tx.date}</td>
                    <td class="px-3 py-2 text-ink">{tx.label}</td>
                    <td class="px-3 py-2">
                      {#if suggestions.has(tx.id) && !rejected.has(tx.id)}
                        <span class="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                          {categoryName(suggestions.get(tx.id)!) ?? 'Suggested'}
                          <button
                            type="button"
                            class="press text-accent/70 hover:text-accent"
                            title="Dismiss suggestion"
                            onclick={() => (rejected = new Set(rejected).add(tx.id))}
                          >×</button>
                        </span>
                      {:else}
                        <span class="text-xs text-muted">—</span>
                      {/if}
                    </td>
                    <td class={cn('px-3 py-2 text-right tnum', tx.amount < 0 ? 'text-expense' : 'text-income')}>
                      {formatMoney(tx.amount, { currency, locale, signed: true })}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <!-- Save profile -->
      <label class="mt-4 flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" bind:checked={saveProfile} />
        Save these settings as a profile
      </label>
      {#if saveProfile}
        <input class="field mt-2" bind:value={newProfileName} placeholder="Profile name (e.g. My bank)" />
      {/if}

      <!-- Actions -->
      <div class="mt-5 flex items-center justify-between">
        <button class="press inline-flex items-center gap-1 text-sm text-muted hover:text-ink" onclick={reset}>
          <ArrowLeft size={16} /> Back
        </button>
        <button
          class={cn('press rounded-control bg-accent px-4 py-2 text-sm font-medium text-white', (!preview || preview.transactions.length === 0 || busy) && 'opacity-50')}
          onclick={commit}
          disabled={!preview || preview.transactions.length === 0 || busy}
        >
          {busy ? 'Importing…' : `Import ${preview?.transactions.length ?? 0} transactions`}
        </button>
      </div>
    </Card>
  {/if}

  {#if step === 'done' && result}
    <Card>
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <div class="grid h-12 w-12 place-items-center rounded-control bg-income/10 text-income">
          <CheckCircle size={26} weight="fill" />
        </div>
        <p class="text-base font-medium text-ink">Import complete</p>
        <p class="text-sm text-muted">
          {result.added} new{result.duplicates ? `, ${result.duplicates} duplicates skipped` : ''}.
        </p>
        <p class="text-xs text-muted">{$transactions} transactions stored in total.</p>
        <button class="press mt-2 rounded-control border border-hairline bg-surface px-4 py-2 text-sm text-ink hover:bg-ink/5" onclick={reset}>
          Import another file
        </button>
      </div>
    </Card>
  {/if}
</div>

<style>
  .field {
    width: 100%;
    min-height: 40px;
    padding: 0 0.625rem;
    border-radius: var(--radius-control, 6px);
    border: 1px solid rgb(var(--c-hairline));
    background-color: rgb(var(--c-surface));
    color: rgb(var(--c-ink));
    font-size: 0.875rem;
  }
  .lbl {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgb(var(--c-muted));
  }
</style>
