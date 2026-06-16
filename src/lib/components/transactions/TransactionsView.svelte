<script lang="ts">
  import { MagnifyingGlass, ArrowUp, ArrowDown, ArrowsDownUp, Funnel } from 'phosphor-svelte';
  import { transactions } from '$lib/stores/transactions';
  import { config } from '$lib/stores/config';
  import { formatMoney } from '$lib/utils/currency';
  import { cn } from '$lib/utils/cn';
  import DateField from '$lib/components/ui/DateField.svelte';
  import type { Transaction } from '$lib/types';

  // ----- data loading -----
  const txAll = transactions.all;
  const txLoading = transactions.loading;

  $effect(() => {
    transactions.loadAll();
  });

  // ----- config aliases -----
  const catMap = $derived(
    new Map(($config?.categories ?? []).map((c) => [c.id, c]))
  );
  const accMap = $derived(
    new Map(($config?.accounts ?? []).map((a) => [a.id, a]))
  );
  const currency = $derived($config?.meta?.currency ?? 'EUR');
  const locale = $derived($config?.meta?.locale ?? 'en-US');

  // ----- filters -----
  let query = $state('');
  let filterType = $state<'all' | 'income' | 'expense'>('all');
  let filterFrom = $state('');
  let filterTo = $state('');
  let filterCat = $state('');

  // ----- sorting -----
  type SortField = 'date' | 'amount' | 'label';
  let sortField = $state<SortField>('date');
  let sortDir = $state<'asc' | 'desc'>('desc');

  function toggleSort(field: SortField) {
    if (sortField === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDir = field === 'date' ? 'desc' : 'asc';
    }
  }

  // ----- derived filtered + sorted list -----
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    let list: Transaction[] = $txAll;

    if (q) list = list.filter((t) => t.normalizedLabel.includes(q) || (t.entity ?? '').toLowerCase().includes(q));
    if (filterType === 'income') list = list.filter((t) => t.amount > 0);
    if (filterType === 'expense') list = list.filter((t) => t.amount < 0);
    if (filterFrom) list = list.filter((t) => t.date >= filterFrom);
    if (filterTo) list = list.filter((t) => t.date <= filterTo);
    if (filterCat) list = list.filter((t) => t.categoryId === filterCat);

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortField === 'date') return dir * a.date.localeCompare(b.date);
      if (sortField === 'amount') return dir * (a.amount - b.amount);
      return dir * a.normalizedLabel.localeCompare(b.normalizedLabel);
    });
  });

  // ----- virtual scroll -----
  // Row height: taller on mobile (date shown as subtitle) vs desktop
  const ROW_H = 56;
  const BUFFER = 8;

  let scrollTop = $state(0);
  let containerH = $state(500);

  const totalH = $derived(filtered.length * ROW_H);
  const startIdx = $derived(Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER));
  const endIdx = $derived(
    Math.min(filtered.length - 1, Math.ceil((scrollTop + containerH) / ROW_H) + BUFFER)
  );
  const visible = $derived(filtered.slice(startIdx, endIdx + 1));
  const padTop = $derived(startIdx * ROW_H);
  const padBottom = $derived(Math.max(0, (filtered.length - endIdx - 1) * ROW_H));

  function onScroll(e: Event) {
    scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
  }

  function fmt(amount: number) {
    return formatMoney(amount, { currency, locale, signed: true });
  }

  function amountTone(amount: number) {
    return amount > 0 ? 'text-income' : 'text-expense';
  }
</script>

<div class="flex h-full flex-col">
  <!-- Toolbar -->
  <div class="border-b border-hairline bg-paper px-4 py-3 md:px-6">
    <div class="mx-auto max-w-[1180px] space-y-2">
      <!-- Row 1: search + type toggle + count -->
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <MagnifyingGlass class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search…"
            bind:value={query}
            class="h-9 w-full rounded-control border border-hairline bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
        <div class="flex h-9 shrink-0 items-center gap-0.5 rounded-control border border-hairline bg-surface p-0.5 text-xs">
          {#each (['all', 'income', 'expense'] as const) as t (t)}
            <button
              class={cn(
                'h-full rounded-[calc(var(--radius-control)-2px)] px-2.5 transition-colors md:px-3',
                filterType === t ? 'bg-accent/15 font-medium text-accent' : 'text-muted hover:text-ink'
              )}
              onclick={() => (filterType = t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          {/each}
        </div>
        <span class="hidden whitespace-nowrap text-xs text-muted sm:block">
          {filtered.length} / {$transactions}
        </span>
      </div>

      <!-- Row 2: date range (hidden on very small, visible on sm+) + category -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1.5 text-xs text-muted">
          <Funnel class="h-3.5 w-3.5 shrink-0" />
          <DateField
            bind:value={filterFrom}
            max={filterTo || undefined}
            label="From date"
            clearable
          />
          <span>–</span>
          <DateField
            bind:value={filterTo}
            min={filterFrom || undefined}
            label="To date"
            clearable
          />
        </div>
        {#if ($config?.categories ?? []).length > 0}
          <select
            bind:value={filterCat}
            class="h-8 rounded-control border border-hairline bg-surface px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="">All categories</option>
            {#each $config?.categories ?? [] as cat (cat.id)}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
        {/if}
        <span class="ml-auto whitespace-nowrap text-xs text-muted sm:hidden">
          {filtered.length} / {$transactions}
        </span>
      </div>
    </div>
  </div>

  <!-- Table header -->
  <div class="border-b border-hairline bg-paper px-4 md:px-6">
    <div class="mx-auto max-w-[1180px]">
      <!-- Mobile: 2 cols. Desktop: 4 cols -->
      <div class="grid grid-cols-[1fr_auto] gap-3 py-2 text-xs font-medium text-muted md:grid-cols-[1fr_160px_120px_120px] md:gap-4">
        <button class="flex items-center gap-1 text-left hover:text-ink" onclick={() => toggleSort('label')}>
          Description
          {#if sortField === 'label'}
            {#if sortDir === 'asc'}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown class="h-3.5 w-3.5" />{/if}
          {:else}
            <ArrowsDownUp class="h-3.5 w-3.5 opacity-40" />
          {/if}
        </button>
        <span class="hidden md:block">Category</span>
        <button class="hidden items-center justify-end gap-1 hover:text-ink md:flex" onclick={() => toggleSort('date')}>
          {#if sortField === 'date'}
            {#if sortDir === 'asc'}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown class="h-3.5 w-3.5" />{/if}
          {:else}
            <ArrowsDownUp class="h-3.5 w-3.5 opacity-40" />
          {/if}
          Date
        </button>
        <button class="flex items-center justify-end gap-1 hover:text-ink" onclick={() => toggleSort('amount')}>
          {#if sortField === 'amount'}
            {#if sortDir === 'asc'}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown class="h-3.5 w-3.5" />{/if}
          {:else}
            <ArrowsDownUp class="h-3.5 w-3.5 opacity-40" />
          {/if}
          Amount
        </button>
      </div>
    </div>
  </div>

  <!-- Virtual scroll body -->
  {#if $txLoading}
    <div class="flex flex-1 items-center justify-center text-sm text-muted">Decrypting…</div>
  {:else if filtered.length === 0}
    <div class="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
      {#if $transactions === 0}
        <p class="text-sm">No transactions yet.</p>
        <a href="#import" class="text-sm text-accent hover:underline">Import a CSV file →</a>
      {:else}
        <p class="text-sm">No transactions match the current filters.</p>
      {/if}
    </div>
  {:else}
    <div
      bind:clientHeight={containerH}
      class="flex-1 overflow-y-auto"
      onscroll={onScroll}
    >
      <div class="px-4 md:px-6" style="height: {totalH}px; box-sizing: content-box;">
        <div style="height: {padTop}px;"></div>

        <div class="mx-auto max-w-[1180px]">
          {#each visible as tx (tx.id)}
            {@const cat = tx.categoryId ? catMap.get(tx.categoryId) : null}
            {@const acc = tx.accountId ? accMap.get(tx.accountId) : null}
            <!-- Mobile: 2 cols. Desktop: 4 cols -->
            <div
              class="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-hairline/50 md:grid-cols-[1fr_160px_120px_120px] md:gap-4"
              style="height: {ROW_H}px; box-sizing: border-box;"
            >
              <!-- Description + date (mobile) / just description (desktop) -->
              <div class="min-w-0">
                <p class="truncate text-sm text-ink">{tx.label}</p>
                <p class="truncate text-xs text-muted">
                  <span class="md:hidden">{tx.date} · </span>{tx.entity ?? acc?.name ?? ''}
                </p>
              </div>

              <!-- Category (desktop only) -->
              <div class="hidden min-w-0 md:block">
                {#if cat}
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                    style="background: {cat.color}22; color: {cat.color};"
                  >
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full" style="background: {cat.color};"></span>
                    {cat.name}
                  </span>
                {:else}
                  <span class="text-xs text-muted/50">—</span>
                {/if}
              </div>

              <!-- Date (desktop only) -->
              <p class="hidden text-right text-xs text-muted md:block">{tx.date}</p>

              <!-- Amount (always visible) -->
              <p class={cn('tnum text-right text-sm font-medium', amountTone(tx.amount))}>
                {fmt(tx.amount)}
              </p>
            </div>
          {/each}
        </div>

        <div style="height: {padBottom}px;"></div>
      </div>
    </div>
  {/if}
</div>
