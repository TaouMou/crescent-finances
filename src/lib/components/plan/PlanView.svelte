<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, Trash, PencilSimple, Check, X, Target } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import ColorField from '$lib/components/ui/ColorField.svelte';
  import DateField from '$lib/components/ui/DateField.svelte';
  import DistributionView from '$lib/components/sections/DistributionView.svelte';
  import TargetProgress from '$lib/components/sections/TargetProgress.svelte';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
  import { openNewGroupRequested } from '$lib/stores/plan-ui';
  import { evaluatePlan } from '$lib/sections/engine';
  import { nextOccurrence } from '$lib/sections/schedule';
  import { safeParseConfig } from '$lib/config/schema';
  import { demoCurrency, demoLocale } from '$lib/seed/dashboard';
  import type { Schedule, Section, SectionCalc, SectionGroup, SectionGroupKind, TransactionFilter } from '$lib/types';

  const txAll = transactions.all;

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);

  const evaluated = $derived(
    evaluatePlan($config?.sectionGroups ?? [], $config?.sections ?? [], $txAll, $config?.assetPools ?? [])
  );

  let saving = $state(false);

  // ----- group editor -----
  interface GroupDraft {
    id?: string;
    name: string;
    kind: SectionGroupKind;
  }
  let editingGroup = $state<GroupDraft | null>(null);

  function newGroup() {
    editingSection = null;
    editingGroup = { name: '', kind: 'distribution' };
  }
  function editGroup(g: SectionGroup) {
    editingSection = null;
    editingGroup = { id: g.id, name: g.name, kind: g.kind };
  }

  async function saveGroup() {
    if (!editingGroup || !$config || !editingGroup.name.trim()) return;
    const draft = editingGroup;
    let groups = [...$config.sectionGroups];
    if (draft.id) {
      groups = groups.map((g) => (g.id === draft.id ? { ...g, name: draft.name.trim(), kind: draft.kind } : g));
    } else {
      groups.push({
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        kind: draft.kind,
        order: groups.length,
        sectionIds: []
      });
    }
    await persist({ sectionGroups: groups });
    editingGroup = null;
  }

  async function deleteGroup(id: string) {
    if (!$config) return;
    const sectionGroups = $config.sectionGroups.filter((g) => g.id !== id);
    // Orphan the group's sections rather than silently dropping them.
    const sections = $config.sections.map((s) => (s.groupId === id ? { ...s, groupId: null } : s));
    await persist({ sectionGroups, sections });
  }

  // ----- section editor -----
  type CalcType = 'percentage' | 'fixed' | 'remainder' | 'target' | 'filterSum' | 'accountBalance';
  interface SectionDraft {
    id?: string;
    groupId: string;
    name: string;
    color: string;
    calcType: CalcType;
    percent: number;
    amountMajor: number;
    targetMajor: number;
    targetDate: string;
    // filterSum fields
    filterCategoryIds: string[];
    filterAccountIds: string[];
    filterTagIds: string[];
    filterQuery: string;
    plannedMajor: number;
    // accountBalance / target-link field
    assetPoolId: string;
    // schedule fields
    scheduleKind: 'none' | 'interval' | 'anniversary';
    intervalEveryDays: number;
    intervalAnchor: string;
    annivMonth: number;
    annivDay: number;
  }
  let editingSection = $state<SectionDraft | null>(null);

  const blankSection = (groupId: string): SectionDraft => ({
    groupId,
    name: '',
    color: '#0DA882',
    calcType: 'percentage',
    percent: 10,
    amountMajor: 0,
    targetMajor: 0,
    targetDate: '',
    filterCategoryIds: [],
    filterAccountIds: [],
    filterTagIds: [],
    filterQuery: '',
    plannedMajor: 0,
    assetPoolId: '',
    scheduleKind: 'none',
    intervalEveryDays: 30,
    intervalAnchor: '',
    annivMonth: 1,
    annivDay: 1
  });

  function newSection(groupId: string) {
    editingGroup = null;
    editingSection = blankSection(groupId);
  }

  function editSection(s: Section) {
    editingGroup = null;
    const d = blankSection(s.groupId ?? '');
    d.id = s.id;
    d.name = s.name;
    d.color = s.color;
    d.calcType =
      s.calc.type === 'percentage' ||
      s.calc.type === 'fixed' ||
      s.calc.type === 'remainder' ||
      s.calc.type === 'target' ||
      s.calc.type === 'filterSum' ||
      s.calc.type === 'accountBalance'
        ? s.calc.type
        : 'percentage';
    if (s.calc.type === 'percentage') d.percent = s.calc.percent;
    if (s.calc.type === 'fixed') d.amountMajor = s.calc.amount / 100;
    if (s.calc.type === 'target') {
      d.targetMajor = s.calc.targetAmount / 100;
      d.targetDate = s.calc.targetDate ?? '';
      d.assetPoolId = s.calc.assetPoolId ?? '';
    }
    if (s.calc.type === 'filterSum') {
      d.filterCategoryIds = s.calc.filter.categoryIds ?? [];
      d.filterAccountIds = s.calc.filter.accountIds ?? [];
      d.filterTagIds = s.calc.filter.tagIds ?? [];
      d.filterQuery = s.calc.filter.query ?? '';
      d.plannedMajor = (s.calc.planned ?? 0) / 100;
    }
    if (s.calc.type === 'accountBalance') d.assetPoolId = s.calc.assetPoolId;
    if (s.schedule) {
      d.scheduleKind = s.schedule.kind;
      if (s.schedule.interval) {
        d.intervalEveryDays = s.schedule.interval.everyDays;
        d.intervalAnchor = s.schedule.interval.anchor;
      }
      if (s.schedule.anniversary) {
        d.annivMonth = s.schedule.anniversary.month;
        d.annivDay = s.schedule.anniversary.day;
      }
    }
    editingSection = d;
  }

  function draftToSchedule(d: SectionDraft): Schedule | undefined {
    if (d.scheduleKind === 'interval' && d.intervalAnchor) {
      return { kind: 'interval', interval: { everyDays: Number(d.intervalEveryDays) || 1, anchor: d.intervalAnchor } };
    }
    if (d.scheduleKind === 'anniversary') {
      return { kind: 'anniversary', anniversary: { calendar: 'gregorian', month: Number(d.annivMonth) || 1, day: Number(d.annivDay) || 1 } };
    }
    return undefined;
  }

  function draftToCalc(d: SectionDraft): SectionCalc {
    switch (d.calcType) {
      case 'percentage':
        return { type: 'percentage', of: { kind: 'income' }, percent: Number(d.percent) || 0 };
      case 'fixed':
        return { type: 'fixed', amount: Math.round((Number(d.amountMajor) || 0) * 100) };
      case 'remainder':
        return { type: 'remainder' };
      case 'target':
        return {
          type: 'target',
          targetAmount: Math.round((Number(d.targetMajor) || 0) * 100),
          targetDate: d.targetDate || undefined,
          assetPoolId: d.assetPoolId || undefined
        };
      case 'accountBalance':
        return { type: 'accountBalance', assetPoolId: d.assetPoolId };
      case 'filterSum': {
        const filter: TransactionFilter = {};
        if (d.filterCategoryIds.length) filter.categoryIds = [...d.filterCategoryIds];
        if (d.filterAccountIds.length) filter.accountIds = [...d.filterAccountIds];
        if (d.filterTagIds.length) filter.tagIds = [...d.filterTagIds];
        if (d.filterQuery.trim()) filter.query = d.filterQuery.trim();
        const planned = Math.round((Number(d.plannedMajor) || 0) * 100);
        return { type: 'filterSum', filter, planned: planned || undefined };
      }
    }
  }

  async function saveSection() {
    if (!editingSection || !$config || !editingSection.name.trim()) return;
    const draft = editingSection;
    const calc = draftToCalc(draft);
    const schedule = draftToSchedule(draft);
    let sections = [...$config.sections];
    if (draft.id) {
      sections = sections.map((s) =>
        s.id === draft.id ? { ...s, name: draft.name.trim(), color: draft.color, groupId: draft.groupId, calc, schedule } : s
      );
    } else {
      const order = sections.filter((s) => s.groupId === draft.groupId).length;
      sections.push({
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        color: draft.color,
        groupId: draft.groupId,
        order,
        calc,
        schedule
      });
    }
    await persist({ sections });
    editingSection = null;
  }

  async function deleteSection(id: string) {
    if (!$config) return;
    await persist({ sections: $config.sections.filter((s) => s.id !== id) });
  }

  // ----- shared persistence -----
  async function persist(patch: Partial<{ sectionGroups: SectionGroup[]; sections: Section[] }>) {
    if (!$config) return;
    const next = { ...$config, ...patch };
    const parsed = safeParseConfig(next);
    if (!parsed.success) {
      console.error('Invalid plan config', parsed.error);
      return;
    }
    saving = true;
    await config.save(next);
    saving = false;
  }

  function sectionsOf(groupId: string): Section[] {
    return ($config?.sections ?? [])
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => a.order - b.order);
  }

  function calcLabel(s: Section): string {
    switch (s.calc.type) {
      case 'percentage':
        return `${s.calc.percent}% of income`;
      case 'fixed':
        return 'Fixed amount';
      case 'remainder':
        return 'Remainder of income';
      case 'target':
        return 'Goal / target';
      case 'filterSum':
        return 'Tracked spending';
      case 'accountBalance':
        return 'Account / pool balance';
    }
  }

  function scheduleLabel(s: Section): string | null {
    if (!s.schedule) return null;
    const next = nextOccurrence(s.schedule);
    const nextStr = next
      ? new Date(`${next}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      : null;
    const base =
      s.schedule.kind === 'interval' && s.schedule.interval
        ? `Every ${s.schedule.interval.everyDays} days`
        : 'Yearly';
    return nextStr ? `${base} · next ${nextStr}` : base;
  }

  onMount(() => {
    if ($openNewGroupRequested) {
      openNewGroupRequested.set(false);
      newGroup();
    }
  });
</script>

<div class="mx-auto max-w-[860px] space-y-6 p-6">
  <!-- Header -->
  <div class="space-y-3">
    <div>
      <h1 class="text-lg font-semibold text-ink">Plan</h1>
      <p class="mt-0.5 text-sm text-muted">
        Split your income into sections (savings, fixed costs, spending) and track goals.
        Add a <em>tracked spending</em> section to see real actuals from your transactions.
      </p>
    </div>
    <button
      class="press flex h-9 items-center gap-2 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80"
      onclick={newGroup}
    >
      <Plus class="h-4 w-4" /> New group
    </button>
  </div>

  <!-- Group editor -->
  {#if editingGroup}
    <div class="rounded-xl border border-accent/30 bg-accent/5 p-5 shadow-sm">
      <h2 class="mb-4 text-sm font-semibold text-ink">{editingGroup.id ? 'Edit group' : 'New group'}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Name</span>
          <input
            type="text"
            bind:value={editingGroup.name}
            placeholder="e.g. Monthly plan"
            class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Kind</span>
          <select
            bind:value={editingGroup.kind}
            class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="distribution">Distribution (planned vs actual)</option>
            <option value="plain">Plain (goals / list)</option>
          </select>
        </label>
      </div>
      <div class="mt-5 flex items-center justify-end gap-2">
        <button class="press flex h-9 items-center gap-1.5 rounded-control px-3 text-sm text-muted hover:bg-ink/5 active:bg-ink/10" onclick={() => (editingGroup = null)}>
          <X class="h-4 w-4" /> Cancel
        </button>
        <button
          class="press flex h-9 items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50"
          onclick={saveGroup}
          disabled={saving || !editingGroup.name.trim()}
        >
          <Check class="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Section editor -->
  {#if editingSection}
    <div class="rounded-xl border border-accent/30 bg-accent/5 p-5 shadow-sm">
      <h2 class="mb-4 text-sm font-semibold text-ink">{editingSection.id ? 'Edit section' : 'New section'}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Name</span>
          <input
            type="text"
            bind:value={editingSection.name}
            placeholder="e.g. Savings"
            class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Color</span>
          <ColorField bind:value={editingSection.color} label="Section color" block />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Type</span>
          <select
            bind:value={editingSection.calcType}
            class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="percentage">Percentage of income</option>
            <option value="fixed">Fixed amount</option>
            <option value="remainder">Remainder of income</option>
            <option value="target">Goal / target</option>
            <option value="filterSum">Tracked spending (filter)</option>
            <option value="accountBalance">Account / pool balance</option>
          </select>
        </label>

        {#if editingSection.calcType === 'percentage'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Percent of income</span>
            <input type="number" min="0" max="100" bind:value={editingSection.percent} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </label>
        {:else if editingSection.calcType === 'fixed'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Amount ({currency})</span>
            <input type="number" min="0" step="0.01" bind:value={editingSection.amountMajor} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </label>
        {:else if editingSection.calcType === 'target'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Target amount ({currency})</span>
            <input type="number" min="0" step="0.01" bind:value={editingSection.targetMajor} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Target date (optional)</span>
            <DateField bind:value={editingSection.targetDate} clearable label="Target date" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs text-muted">Track progress from (optional)</span>
            <select bind:value={editingSection.assetPoolId} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50">
              <option value="">Not linked — progress stays 0%</option>
              {#each $config?.assetPools ?? [] as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </label>
        {:else if editingSection.calcType === 'accountBalance'}
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs text-muted">Asset pool</span>
            {#if ($config?.assetPools ?? []).length > 0}
              <select bind:value={editingSection.assetPoolId} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50">
                <option value="">Select a pool…</option>
                {#each $config?.assetPools ?? [] as p (p.id)}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            {:else}
              <span class="text-xs text-muted">No asset pools yet — create accounts and a pool in Settings first.</span>
            {/if}
          </label>
        {:else if editingSection.calcType === 'filterSum'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Categories</span>
            {#if ($config?.categories ?? []).length > 0}
              <select
                multiple
                bind:value={editingSection.filterCategoryIds}
                class="min-h-[5.5rem] rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
              >
                {#each $config?.categories ?? [] as c (c.id)}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
            {:else}
              <span class="text-xs text-muted">No categories defined — add some in Settings, or use a label filter below.</span>
            {/if}
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Planned (optional, {currency})</span>
            <input type="number" min="0" step="0.01" bind:value={editingSection.plannedMajor} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </label>
          <details class="sm:col-span-2">
            <summary class="cursor-pointer text-xs text-muted hover:text-ink">More filters</summary>
            <div class="mt-3 grid gap-4 sm:grid-cols-2">
              {#if ($config?.accounts ?? []).length > 0}
                <label class="flex flex-col gap-1">
                  <span class="text-xs text-muted">Accounts</span>
                  <select multiple bind:value={editingSection.filterAccountIds} class="min-h-[4.5rem] rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50">
                    {#each $config?.accounts ?? [] as a (a.id)}
                      <option value={a.id}>{a.name}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              {#if ($config?.tags ?? []).length > 0}
                <label class="flex flex-col gap-1">
                  <span class="text-xs text-muted">Tags</span>
                  <select multiple bind:value={editingSection.filterTagIds} class="min-h-[4.5rem] rounded-control border border-hairline bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50">
                    {#each $config?.tags ?? [] as t (t.id)}
                      <option value={t.id}>{t.name}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              <label class="flex flex-col gap-1 sm:col-span-2">
                <span class="text-xs text-muted">Label contains</span>
                <input type="text" bind:value={editingSection.filterQuery} placeholder="e.g. groceries" class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
              </label>
            </div>
          </details>
        {/if}

        <!-- Schedule (optional, applies to any section) -->
        <label class="flex flex-col gap-1 sm:col-span-2">
          <span class="text-xs text-muted">Schedule (optional)</span>
          <select
            bind:value={editingSection.scheduleKind}
            class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="none">None</option>
            <option value="interval">Every N days</option>
            <option value="anniversary">Yearly (month / day)</option>
          </select>
        </label>
        {#if editingSection.scheduleKind === 'interval'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Every (days)</span>
            <input type="number" min="1" bind:value={editingSection.intervalEveryDays} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Starting from</span>
            <DateField bind:value={editingSection.intervalAnchor} clearable label="Anchor date" />
          </label>
        {:else if editingSection.scheduleKind === 'anniversary'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Month (1–12)</span>
            <input type="number" min="1" max="12" bind:value={editingSection.annivMonth} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Day (1–31)</span>
            <input type="number" min="1" max="31" bind:value={editingSection.annivDay} class="h-9 rounded-control border border-hairline bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50" />
          </label>
        {/if}
      </div>
      <div class="mt-5 flex items-center justify-end gap-2">
        <button class="press flex h-9 items-center gap-1.5 rounded-control px-3 text-sm text-muted hover:bg-ink/5 active:bg-ink/10" onclick={() => (editingSection = null)}>
          <X class="h-4 w-4" /> Cancel
        </button>
        <button
          class="press flex h-9 items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50"
          onclick={saveSection}
          disabled={saving || !editingSection.name.trim() || (editingSection.calcType === 'target' && !(Number(editingSection.targetMajor) > 0)) || (editingSection.calcType === 'accountBalance' && !editingSection.assetPoolId)}
        >
          <Check class="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Empty state -->
  {#if evaluated.length === 0 && !editingGroup}
    <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent/5 py-12 text-center">
      <p class="text-base font-medium text-ink">No plan groups yet</p>
      <p class="text-sm text-muted">Create a group to start allocating income and tracking goals.</p>
      <button
        class="press mt-2 flex h-9 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80"
        onclick={newGroup}
      >
        <Plus class="h-4 w-4" /> New group
      </button>
    </div>
  {/if}

  <!-- Groups -->
  {#each evaluated as ev (ev.group.id)}
    <Card>
      <div class="mb-4 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <h2 class="card-title truncate">{ev.group.name}</h2>
          <span class="text-xs text-muted capitalize">{ev.group.kind}</span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button class="press flex h-8 items-center gap-1.5 rounded-control border border-hairline px-2.5 text-xs text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={() => newSection(ev.group.id)} title="Add section">
            <Plus class="h-3.5 w-3.5" /> Section
          </button>
          <button class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={() => editGroup(ev.group)} title="Edit group">
            <PencilSimple class="h-4 w-4" />
          </button>
          <button class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20" onclick={() => deleteGroup(ev.group.id)} title="Delete group">
            <Trash class="h-4 w-4" />
          </button>
        </div>
      </div>

      {#if ev.distribution.sections.length > 0}
        <DistributionView group={ev.distribution} {currency} {locale} />
      {/if}

      {#if ev.targets.length > 0}
        <div class="mt-5">
          <h3 class="mb-3 flex items-center gap-1.5 text-sm font-medium text-ink"><Target class="h-4 w-4 text-accent" /> Goals</h3>
          <TargetProgress items={ev.targets} {currency} {locale} />
        </div>
      {/if}

      <!-- Section management -->
      {#if sectionsOf(ev.group.id).length > 0}
        <ul class="mt-5 divide-y divide-hairline border-t border-hairline pt-1">
          {#each sectionsOf(ev.group.id) as s (s.id)}
            <li class="flex items-center gap-3 py-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={`background:${s.color}`}></span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-ink">{s.name}</p>
                <p class="truncate text-xs text-muted">
                  {calcLabel(s)}{#if scheduleLabel(s)} · {scheduleLabel(s)}{/if}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={() => editSection(s)} title="Edit section">
                  <PencilSimple class="h-4 w-4" />
                </button>
                <button class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20" onclick={() => deleteSection(s.id)} title="Delete section">
                  <Trash class="h-4 w-4" />
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-4 text-sm text-muted">No sections yet — add one to allocate income or set a goal.</p>
      {/if}
    </Card>
  {/each}
</div>
