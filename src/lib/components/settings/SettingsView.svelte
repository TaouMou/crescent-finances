<script lang="ts">
  import { DownloadSimple, UploadSimple, Check, Plus, Trash, Warning, Sparkle, Cloud, ArrowsClockwise } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import ColorField from '$lib/components/ui/ColorField.svelte';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
  import { balances } from '$lib/stores/balances';
  import { demoMode } from '$lib/stores/demo';
  import { vault } from '$lib/stores/vault';
  import { cryptoWorker } from '$lib/workers/cryptoClient';
  import { vaultRepo, transactionRepo, configRepo, balanceRepo, dateBucketOf } from '$lib/db/repos';
  import {
    serializeConfigTemplate,
    parseConfigTemplate,
    buildBackup,
    serializeBackup,
    parseBackup
  } from '$lib/config/backup';
  import { starterCategories, starterRules } from '$lib/config/schema';
  import { buildStartingBalances, balancesEqual, type BalanceRowDraft } from '$lib/balances/form';
  import { syncStore } from '$lib/stores/sync';
  import { loadClientId } from '$lib/sync/gdrive';
  import type { AppConfig, StartingBalances, Transaction } from '$lib/types';

  let savedAt = $state<string | null>(null);
  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  const txCount = transactions;

  // ----- Google Drive sync -----
  let syncClientId = $state(loadClientId() ?? '');

  function formatRelative(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  }

  async function connectDrive() {
    const id = syncClientId.trim();
    if (!id) return;
    await syncStore.connect(id);
  }

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

  // ----- tags -----
  let newTagName = $state('');
  let newTagColor = $state('#0DA882');

  function addTag() {
    const name = newTagName.trim();
    if (!name) return;
    patch((c) => ({
      ...c,
      tags: [...(c.tags ?? []), { id: crypto.randomUUID(), name, color: newTagColor }]
    }));
    newTagName = '';
    newTagColor = '#0DA882';
  }

  function updateTag(id: string, field: 'name' | 'color', value: string) {
    patch((c) => ({
      ...c,
      tags: (c.tags ?? []).map((t) => (t.id === id ? { ...t, [field]: value } : t))
    }));
  }

  function deleteTag(id: string) {
    patch((c) => ({
      ...c,
      tags: (c.tags ?? []).filter((t) => t.id !== id),
      rules: c.rules.map((r) => ({ ...r, addTagIds: (r.addTagIds ?? []).filter((tid) => tid !== id) }))
    }));
  }

  // ----- accounts -----
  let newAccName = $state('');
  let newAccKind = $state<'bank' | 'cash' | 'card' | 'savings'>('bank');

  function addAccount() {
    const name = newAccName.trim();
    if (!name) return;
    patch((c) => ({ ...c, accounts: [...c.accounts, { id: crypto.randomUUID(), name, kind: newAccKind }] }));
    newAccName = '';
    newAccKind = 'bank';
  }

  function updateAccount(id: string, field: 'name' | 'kind', value: string) {
    patch((c) => ({
      ...c,
      accounts: c.accounts.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    }));
  }

  function deleteAccount(id: string) {
    patch((c) => ({
      ...c,
      accounts: c.accounts.filter((a) => a.id !== id),
      // Drop the account from any pool that referenced it.
      assetPools: c.assetPools.map((p) => ({ ...p, accountIds: p.accountIds.filter((x) => x !== id) }))
    }));
  }

  // ----- starting balances (encrypted, never in config) -----
  // `baseline` is the persisted map; `rows` holds only the keys the user has
  // edited. Saving is explicit (Confirm changes) and builds a plain object so
  // the worker can structured-clone it (a $state proxy can't be — that silent
  // DataCloneError is why balances never saved before).
  let baseline = $state<StartingBalances>({});
  let rows = $state<Record<string, BalanceRowDraft>>({});
  let balancesLoaded = $state(false);
  let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let saveError = $state<string | null>(null);

  $effect(() => {
    if (balancesLoaded) return;
    balances.load().then((b) => {
      baseline = structuredClone(b);
      balancesLoaded = true;
    });
  });

  // Rows: one per account, plus a catch-all for account-less transactions.
  const balanceRows = $derived([
    ...($config?.accounts ?? []).map((a) => ({ key: a.id, name: a.name })),
    { key: '', name: 'Unassigned (no account)' }
  ]);

  const today = () => new Date().toISOString().slice(0, 10);

  function baseRow(key: string): BalanceRowDraft {
    const sb = baseline[key];
    return { amountStr: sb ? String(sb.amount / 100) : '', asOf: sb?.asOf ?? '' };
  }
  const amountValue = (key: string): string => (rows[key] ?? baseRow(key)).amountStr;
  const dateValue = (key: string): string => (rows[key] ?? baseRow(key)).asOf;

  function setRow(key: string, field: keyof BalanceRowDraft, value: string) {
    rows[key] = { ...(rows[key] ?? baseRow(key)), [field]: value };
    if (saveState !== 'idle') saveState = 'idle';
  }

  // The full edited map (edited rows over the persisted baseline).
  function currentMap(): StartingBalances {
    const merged: Record<string, BalanceRowDraft> = {};
    for (const r of balanceRows) merged[r.key] = rows[r.key] ?? baseRow(r.key);
    return buildStartingBalances(merged, today());
  }

  const dirty = $derived(balancesLoaded && !balancesEqual(currentMap(), baseline));

  async function confirmBalances() {
    if (!dirty) return;
    saveState = 'saving';
    saveError = null;
    try {
      const next = currentMap(); // fresh plain object — safe to post to the worker
      await balances.save(next);
      baseline = next;
      rows = {};
      saveState = 'saved';
      setTimeout(() => saveState === 'saved' && (saveState = 'idle'), 2500);
    } catch (err) {
      saveState = 'error';
      saveError = err instanceof Error ? err.message : 'Could not save balances.';
    }
  }

  // ----- asset pools -----
  let newPoolName = $state('');

  function addPool() {
    const name = newPoolName.trim();
    if (!name) return;
    patch((c) => ({ ...c, assetPools: [...c.assetPools, { id: crypto.randomUUID(), name, accountIds: [] }] }));
    newPoolName = '';
  }

  function updatePoolName(id: string, name: string) {
    patch((c) => ({ ...c, assetPools: c.assetPools.map((p) => (p.id === id ? { ...p, name } : p)) }));
  }

  function togglePoolAccount(poolId: string, accountId: string, on: boolean) {
    patch((c) => ({
      ...c,
      assetPools: c.assetPools.map((p) =>
        p.id === poolId
          ? { ...p, accountIds: on ? [...new Set([...p.accountIds, accountId])] : p.accountIds.filter((x) => x !== accountId) }
          : p
      )
    }));
  }

  function deletePool(id: string) {
    patch((c) => ({ ...c, assetPools: c.assetPools.filter((p) => p.id !== id) }));
  }

  // ----- encrypted backup -----
  let backupError = $state<string | null>(null);
  let backupFile: HTMLInputElement;
  let restoreFile = $state<File | null>(null);
  let restorePass = $state('');
  let restoring = $state(false);

  async function exportBackup() {
    backupError = null;
    if (!$config) return;
    try {
      const material = await vaultRepo.getMaterial();
      if (!material) {
        backupError = 'No vault on this device.';
        return;
      }
      const stored = await transactionRepo.allEncrypted();
      const balancesBlob = await balanceRepo.getBlob();
      const backup = buildBackup({
        config: $config,
        kdf: { saltB64: material.saltB64, iterations: material.iterations },
        verifier: material.verifier,
        transactions: stored.map((s) => ({ fingerprint: s.fingerprint, iv: s.blob.iv, ct: s.blob.ct })),
        balances: balancesBlob ?? undefined
      });
      const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crescent-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      backupError = err instanceof Error ? err.message : 'Export failed.';
    }
  }

  /**
   * Restore an encrypted backup. This REPLACES the vault, config and all
   * transactions on this device, then reloads. Unlocking with the backup's
   * passphrase derives the key the backup was encrypted with.
   */
  async function restoreBackup() {
    backupError = null;
    if (!restoreFile || !restorePass) return;
    restoring = true;
    try {
      const backup = parseBackup(await restoreFile.text());
      // Derive + verify the backup's key inside the worker.
      const { ok } = await cryptoWorker.unlock({
        passphrase: restorePass,
        saltB64: backup.kdf.saltB64,
        iterations: backup.kdf.iterations,
        verifier: backup.verifier
      });
      if (!ok) {
        backupError = 'That passphrase did not match the backup.';
        return;
      }
      // Decrypt to recover each row's id/date; use the fingerprint stored in the
      // backup directly (avoids relying on the decrypted object's fingerprint field).
      const blobs = backup.transactions.map((t) => ({ iv: t.iv, ct: t.ct }));
      const txs = await cryptoWorker.decryptMany<Transaction>(blobs);
      await vaultRepo.saveMaterial({
        saltB64: backup.kdf.saltB64,
        iterations: backup.kdf.iterations,
        verifier: backup.verifier
      });
      await configRepo.save(backup.config);
      if (backup.balances) await balanceRepo.saveBlob(backup.balances);
      await transactionRepo.clear();
      if (txs.length) {
        await transactionRepo.bulkUpdateBlobs(
          txs.map((tx, i) => ({
            id: tx.id,
            fingerprint: backup.transactions[i].fingerprint,
            dateBucket: dateBucketOf(tx.date),
            blob: blobs[i]
          }))
        );
      }
      // Reload so the app re-initialises cleanly from the restored vault.
      location.reload();
    } catch (err) {
      backupError = err instanceof Error ? err.message : 'Restore failed.';
    } finally {
      restoring = false;
    }
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

  // ----- anomaly thresholds -----
  function setAnomaly(key: keyof AppConfig['settings']['anomaly'], v: number) {
    patch((c) => ({ ...c, settings: { ...c.settings, anomaly: { ...c.settings.anomaly, [key]: v } } }));
  }

  // "Sensitivity" is a friendlier face for the MAD multiplier: a lower k flags
  // more (higher sensitivity), a higher k only flags bigger surprises.
  const LEVEL_TO_MADK: Record<string, number> = { high: 2, medium: 3, low: 4 };
  function madKLevel(k: number): 'high' | 'medium' | 'low' {
    if (k <= 2.5) return 'high';
    if (k < 3.5) return 'medium';
    return 'low';
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

<div class="mx-auto max-w-[720px] space-y-6 px-4 py-6 sm:p-6">
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

  <!-- Demo data -->
  <Card>
    <h2 class="card-title mb-1">Demo data</h2>
    <p class="mb-4 text-xs text-muted">
      Shows illustrative sample figures on the Dashboard and Monthly views while you have no
      transactions imported, so you can see how the app works. Turn this off for a clean,
      empty workspace — once you import real data it always takes over regardless of this setting.
    </p>
    <div class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-hairline p-3">
      <div class="min-w-0">
        <p class="text-sm text-ink">Show sample data when empty</p>
        <p class="text-xs text-muted">{$demoMode ? 'Sample figures are shown until you import.' : 'Empty states are shown until you import.'}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={$demoMode}
        aria-label="Show sample data when empty"
        onclick={() => demoMode.toggle()}
        class={`press relative h-6 w-11 shrink-0 rounded-full transition-colors ${$demoMode ? 'bg-accent' : 'bg-ink/20'}`}
      >
        <span
          class={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${$demoMode ? 'left-[22px]' : 'left-0.5'}`}
        ></span>
      </button>
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
            <ColorField
              value={cat.color}
              onValue={(c) => updateCategory(cat.id, 'color', c)}
              label="{cat.name || 'Category'} color"
              class="h-8 w-9"
            />
            <input
              type="text"
              value={cat.name}
              onchange={(e) => updateCategory(cat.id, 'name', e.currentTarget.value.trim())}
              class="h-8 min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
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

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div class="flex flex-1 items-center gap-2">
        <ColorField bind:value={newCatColor} label="New category color" />
        <input
          type="text"
          bind:value={newCatName}
          placeholder="New category name"
          onkeydown={(e) => e.key === 'Enter' && addCategory()}
          class={inputCls + ' min-w-0 flex-1'}
        />
      </div>
      <button
        class="press flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 sm:w-auto"
        onclick={addCategory}
        disabled={!newCatName.trim()}
      >
        <Plus class="h-4 w-4" /> Add
      </button>
    </div>
  </Card>

  <!-- Accounts -->
  <Card>
    <h2 class="card-title mb-1">Accounts</h2>
    <p class="mb-4 text-xs text-muted">Where transactions live. Group accounts into pools below to track balances and goals.</p>

    {#if ($config?.accounts ?? []).length > 0}
      <ul class="mb-4 divide-y divide-hairline border-y border-hairline">
        {#each $config?.accounts ?? [] as acc (acc.id)}
          <li class="flex items-center gap-2 py-2">
            <input
              type="text"
              value={acc.name}
              onchange={(e) => updateAccount(acc.id, 'name', e.currentTarget.value.trim())}
              class="h-8 min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <select
              value={acc.kind}
              onchange={(e) => updateAccount(acc.id, 'kind', e.currentTarget.value)}
              class="h-8 shrink-0 rounded-control border border-hairline bg-surface px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="savings">Savings</option>
            </select>
            <button
              class="press grid h-8 w-8 shrink-0 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20"
              onclick={() => deleteAccount(acc.id)}
              title="Delete account"
            >
              <Trash class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mb-4 text-sm text-muted">No accounts yet.</p>
    {/if}

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="text" bind:value={newAccName} placeholder="New account name" onkeydown={(e) => e.key === 'Enter' && addAccount()} class={inputCls + ' w-full min-w-0 sm:flex-1'} />
      <div class="flex gap-2">
        <select bind:value={newAccKind} class="h-9 flex-1 rounded-control border border-hairline bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50 sm:flex-none">
          <option value="bank">Bank</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="savings">Savings</option>
        </select>
        <button class="press flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 sm:flex-none" onclick={addAccount} disabled={!newAccName.trim()}>
          <Plus class="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  </Card>

  <!-- Account balances -->
  <Card>
    <h2 class="card-title mb-1">Account balances</h2>
    <p class="mb-2 text-xs text-muted">
      Your real balance for each account as of a date — the number your bank shows today is
      easiest. The dashboard's <span class="font-medium text-ink">Liquid balance</span> is this
      starting figure plus every transaction since, so it reflects the actual money on hand.
      Stored encrypted; never in the shareable config or template. Leave an amount blank to clear
      its anchor.
    </p>
    {#if ($config?.accounts ?? []).length === 0}
      <p class="mb-4 text-xs text-warn">
        No accounts yet — add your bank account in <span class="font-medium">Accounts</span> above,
        then its balance will appear here.
      </p>
    {/if}

    <ul class="divide-y divide-hairline border-y border-hairline">
      {#each balanceRows as row (row.key)}
        <li class="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <span class="min-w-0 flex-1 truncate text-sm text-ink">{row.name}</span>
          <div class="flex items-center gap-2">
            <div class="relative">
              <span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">
                {$config?.meta.currency ?? ''}
              </span>
              <input
                type="text"
                inputmode="decimal"
                value={amountValue(row.key)}
                oninput={(e) => setRow(row.key, 'amountStr', e.currentTarget.value)}
                placeholder="0.00"
                aria-label="{row.name} starting balance"
                class="h-9 w-32 rounded-control border border-hairline bg-surface py-0 pl-12 pr-2.5 text-right text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>
            <input
              type="date"
              value={dateValue(row.key)}
              oninput={(e) => setRow(row.key, 'asOf', e.currentTarget.value)}
              aria-label="{row.name} balance date"
              class="h-9 rounded-control border border-hairline bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          </div>
        </li>
      {/each}
    </ul>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onclick={confirmBalances}
        disabled={!dirty || saveState === 'saving'}
        class="press flex h-9 items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50"
      >
        <Check class="h-4 w-4" />
        {saveState === 'saving' ? 'Saving…' : 'Confirm changes'}
      </button>
      {#if saveState === 'saved'}
        <span class="flex items-center gap-1 text-xs text-income"><Check class="h-3.5 w-3.5" /> Saved</span>
      {:else if saveState === 'error'}
        <span class="text-xs text-expense">{saveError}</span>
      {:else if dirty}
        <span class="text-xs text-muted">Unsaved changes</span>
      {/if}
    </div>
  </Card>

  <!-- Advanced settings (collapsed by default) -->
  <details class="group">
    <summary class="flex cursor-pointer select-none items-center gap-2 py-1 text-sm font-medium text-muted hover:text-ink">
      <span class="transition-transform group-open:rotate-90">›</span>
      Advanced settings
    </summary>
    <p class="mb-4 mt-1 pl-5 text-xs text-muted">
      Anomaly tuning, tags, asset pools, backups, sync and reset. You can ignore these to start.
    </p>
    <div class="space-y-6">

  <!-- Anomaly detection -->
  <Card>
    <h2 class="card-title mb-1">Anomaly detection</h2>
    <p class="mb-4 text-xs text-muted">Flags a category when its spending this month jumps unusually above its recent months — surfaced on the dashboard Anomalies card.</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Months to compare against</span>
        <input type="number" min="1" value={$config?.settings.anomaly.baselineMonths ?? 6} onchange={(e) => setAnomaly('baselineMonths', Number(e.currentTarget.value))} class={inputCls} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Minimum increase (%)</span>
        <input type="number" min="0" value={$config?.settings.anomaly.thresholdPct ?? 40} onchange={(e) => setAnomaly('thresholdPct', Number(e.currentTarget.value))} class={inputCls} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Minimum amount ({$config?.meta.currency ?? ''})</span>
        <input type="number" min="0" step="0.01" value={($config?.settings.anomaly.minAbsolute ?? 5000) / 100} onchange={(e) => setAnomaly('minAbsolute', Math.round(parseFloat(e.currentTarget.value || '0') * 100))} class={inputCls} />
        <span class="text-[11px] text-muted/80">Ignore jumps smaller than this.</span>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted">Sensitivity</span>
        <select value={madKLevel($config?.settings.anomaly.madK ?? 3)} onchange={(e) => setAnomaly('madK', LEVEL_TO_MADK[e.currentTarget.value] ?? 3)} class={inputCls}>
          <option value="high">High — flag more</option>
          <option value="medium">Medium</option>
          <option value="low">Low — only big surprises</option>
        </select>
      </label>
    </div>
  </Card>

  <!-- Tags -->
  <Card>
    <h2 class="card-title mb-1">Tags</h2>
    <p class="mb-4 text-xs text-muted">
      Stackable labels for transactions. Unlike categories, a transaction can carry multiple tags — useful for cross-cutting flags like "Reimbursable" or "Holiday trip". Assign them via rules.
    </p>

    {#if ($config?.tags ?? []).length > 0}
      <ul class="mb-4 divide-y divide-hairline border-y border-hairline">
        {#each $config?.tags ?? [] as tag (tag.id)}
          <li class="flex items-center gap-2 py-2">
            <ColorField
              value={tag.color}
              onValue={(c) => updateTag(tag.id, 'color', c)}
              label="{tag.name || 'Tag'} color"
              class="h-8 w-9"
            />
            <input
              type="text"
              value={tag.name}
              onchange={(e) => updateTag(tag.id, 'name', e.currentTarget.value.trim())}
              class="h-8 min-w-0 flex-1 rounded-control border border-hairline bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <button
              class="press grid h-8 w-8 shrink-0 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20"
              onclick={() => deleteTag(tag.id)}
              title="Delete tag"
            >
              <Trash class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mb-4 text-sm text-muted">No tags yet — add one below.</p>
    {/if}

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div class="flex flex-1 items-center gap-2">
        <ColorField bind:value={newTagColor} label="New tag color" />
        <input
          type="text"
          bind:value={newTagName}
          placeholder="New tag name"
          onkeydown={(e) => e.key === 'Enter' && addTag()}
          class={inputCls + ' min-w-0 flex-1'}
        />
      </div>
      <button
        class="press flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 sm:w-auto"
        onclick={addTag}
        disabled={!newTagName.trim()}
      >
        <Plus class="h-4 w-4" /> Add
      </button>
    </div>
  </Card>

  <!-- Asset pools -->
  <Card>
    <h2 class="card-title mb-1">Asset pools</h2>
    <p class="mb-4 text-xs text-muted">A pool's balance is the net of its accounts' transactions — used by "Account / pool balance" sections and to track goal progress.</p>

    {#if ($config?.accounts ?? []).length === 0}
      <p class="mb-4 text-sm text-muted">Add an account first, then group accounts into a pool.</p>
    {/if}

    {#if ($config?.assetPools ?? []).length > 0}
      <ul class="mb-4 space-y-3 border-y border-hairline py-3">
        {#each $config?.assetPools ?? [] as pool (pool.id)}
          <li class="space-y-2">
            <div class="flex items-center gap-2">
              <input
                type="text"
                value={pool.name}
                onchange={(e) => updatePoolName(pool.id, e.currentTarget.value.trim())}
                class="h-8 flex-1 rounded-control border border-hairline bg-surface px-2.5 text-sm font-medium text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
              <button class="press grid h-8 w-8 shrink-0 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20" onclick={() => deletePool(pool.id)} title="Delete pool">
                <Trash class="h-4 w-4" />
              </button>
            </div>
            {#if ($config?.accounts ?? []).length > 0}
              <div class="flex flex-wrap gap-x-4 gap-y-1.5 pl-1">
                {#each $config?.accounts ?? [] as acc (acc.id)}
                  <label class="flex items-center gap-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={pool.accountIds.includes(acc.id)}
                      onchange={(e) => togglePoolAccount(pool.id, acc.id, e.currentTarget.checked)}
                    />
                    {acc.name}
                  </label>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="text" bind:value={newPoolName} placeholder="New pool name" onkeydown={(e) => e.key === 'Enter' && addPool()} class={inputCls + ' w-full min-w-0 sm:flex-1'} />
      <button class="press flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 sm:w-auto" onclick={addPool} disabled={!newPoolName.trim()}>
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

  <!-- Encrypted backup -->
  <Card>
    <h2 class="card-title mb-1">Encrypted backup</h2>
    <p class="mb-4 text-xs text-muted">
      A self-contained backup of your configuration and every transaction (transactions stay
      encrypted). Restore it on any device with the passphrase it was made with.
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <button class="press flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={exportBackup} disabled={!$config}>
        <DownloadSimple class="h-4 w-4" /> Export backup
      </button>
      <button class="press flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={() => backupFile.click()}>
        <UploadSimple class="h-4 w-4" /> Choose backup file…
      </button>
      <input bind:this={backupFile} type="file" accept="application/json,.json" class="hidden" onchange={(e) => { restoreFile = e.currentTarget.files?.[0] ?? null; backupError = null; }} />
    </div>

    {#if restoreFile}
      <div class="mt-3 space-y-2 rounded-control border border-warn/30 bg-warn/5 p-3">
        <p class="text-xs text-ink">
          Restoring <span class="font-medium">{restoreFile.name}</span> will <span class="font-medium text-warn">replace</span>
          the configuration and all transactions on this device.
        </p>
        <div class="flex flex-col gap-2">
          <input
            type="password"
            bind:value={restorePass}
            placeholder="Backup passphrase"
            class="h-9 w-full rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          <div class="flex gap-2">
            <button class="press h-9 flex-1 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50" onclick={restoreBackup} disabled={restoring || !restorePass}>
              {restoring ? 'Restoring…' : 'Restore & replace'}
            </button>
            <button class="press h-9 shrink-0 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5" onclick={() => { restoreFile = null; restorePass = ''; }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if backupError}
      <p class="mt-3 text-xs text-expense">{backupError}</p>
    {/if}
  </Card>

  <!-- Google Drive sync -->
  <Card>
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="card-title mb-1">Google Drive sync</h2>
        <p class="text-xs text-muted">
          Sync your encrypted backup automatically. Data is end-to-end encrypted before
          leaving this device — Google never sees your transactions.
        </p>
      </div>
      {#if $syncStore.connected}
        <span class="flex shrink-0 items-center gap-1 rounded-full bg-income/10 px-2 py-0.5 text-xs font-medium text-income">
          <Cloud class="h-3 w-3" /> Connected
        </span>
      {/if}
    </div>

    {#if $syncStore.connected}
      <div class="mt-4 space-y-3">
        {#if $syncStore.lastSyncedAt}
          <p class="text-xs text-muted">Last synced {formatRelative($syncStore.lastSyncedAt)}</p>
        {/if}
        {#if $syncStore.error}
          <p class="text-xs text-expense">{$syncStore.error}</p>
        {/if}
        <div class="flex flex-wrap gap-2">
          <button
            class="press flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10 disabled:opacity-50"
            onclick={() => syncStore.sync()}
            disabled={$syncStore.status === 'syncing'}
          >
            <ArrowsClockwise class="h-4 w-4 {$syncStore.status === 'syncing' ? 'animate-spin' : ''}" />
            {$syncStore.status === 'syncing' ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            class="press flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
            onclick={() => syncStore.disconnect()}
          >
            Disconnect
          </button>
        </div>
      </div>
    {:else}
      <div class="mt-4 space-y-3">
        <details class="text-xs text-muted">
          <summary class="cursor-pointer select-none hover:text-ink">How to get a Client ID ›</summary>
          <ol class="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
            <li>Go to <strong class="text-ink">console.cloud.google.com</strong> and create a project.</li>
            <li>Enable the <strong class="text-ink">Google Drive API</strong> for that project.</li>
            <li>Under <em>Credentials</em>, create an <strong class="text-ink">OAuth 2.0 Web application</strong> credential.</li>
            <li>Add this page's origin to <em>Authorised JavaScript origins</em>.</li>
            <li>Copy the <strong class="text-ink">Client ID</strong> and paste it below.</li>
          </ol>
        </details>

        <input
          type="text"
          bind:value={syncClientId}
          placeholder="…apps.googleusercontent.com"
          class="h-9 w-full rounded-control border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
        />

        {#if $syncStore.error && !$syncStore.connected}
          <p class="text-xs text-expense">{$syncStore.error}</p>
        {/if}

        <button
          class="press flex h-9 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50"
          onclick={connectDrive}
          disabled={!syncClientId.trim() || $syncStore.status === 'syncing'}
        >
          <Cloud class="h-4 w-4" />
          {$syncStore.status === 'syncing' ? 'Connecting…' : 'Connect Google Drive'}
        </button>
      </div>
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
          <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <span class="text-xs text-expense">Delete all {$txCount} transactions?</span>
            <div class="flex gap-2">
              <button class="press h-8 rounded-control bg-expense px-3 text-xs font-medium text-white hover:bg-expense/90" onclick={clearTransactions}>Delete</button>
              <button class="press h-8 rounded-control border border-hairline px-3 text-xs text-muted hover:bg-ink/5" onclick={() => (confirming = null)}>Cancel</button>
            </div>
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
          <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <span class="text-xs text-expense">Erase everything on this device?</span>
            <div class="flex gap-2">
              <button class="press h-8 rounded-control bg-expense px-3 text-xs font-medium text-white hover:bg-expense/90" onclick={fullReset}>Erase</button>
              <button class="press h-8 rounded-control border border-hairline px-3 text-xs text-muted hover:bg-ink/5" onclick={() => (confirming = null)}>Cancel</button>
            </div>
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
  </details>
</div>
