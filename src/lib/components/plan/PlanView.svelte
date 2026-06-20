<script lang="ts">
  import { Plus, Trash, PencilSimple, Check, X, Target, CaretLeft, CaretRight } from 'phosphor-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue
  } from '$lib/components/ui/select';
  import ColorField from '$lib/components/ui/ColorField.svelte';
  import DateField from '$lib/components/ui/DateField.svelte';
  import DistributionView from '$lib/components/sections/DistributionView.svelte';
  import TargetProgress from '$lib/components/sections/TargetProgress.svelte';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
  import { evaluatePlan } from '$lib/sections/engine';
  import { planTemplates, type PlanTemplate } from '$lib/sections/templates';
  import { safeParseConfig } from '$lib/config/schema';
  import { demoCurrency, demoLocale } from '$lib/seed/dashboard';
  import { monthKey, currentMonth, monthBounds, formatMonthLabel } from '$lib/utils/dates';
  import { describeFilter } from '$lib/utils/filterDescription';
  import type { Schedule, Section, SectionCalc, SectionGroup, SectionGroupKind, TransactionFilter } from '$lib/types';

  const txAll = transactions.all;

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);

  // ----- month selection -----
  let selectedMonth = $state(currentMonth());
  const planBounds = $derived(monthBounds(selectedMonth));

  function prevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    selectedMonth = monthKey(new Date(y, m - 2, 1));
  }
  function nextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    selectedMonth = monthKey(new Date(y, m, 1));
  }

  const evaluated = $derived(
    evaluatePlan(
      $config?.sectionGroups ?? [],
      $config?.sections ?? [],
      $txAll,
      $config?.assetPools ?? [],
      planBounds.from,
      planBounds.to
    )
  );

  // True once at least one income transaction exists; until then percentage /
  // remainder buckets evaluate to 0 and we surface a gentle note.
  const hasIncome = $derived(($txAll ?? []).some((t) => t.amount > 0));

  const filterDescriptions = $derived.by(() => {
    const result: Record<string, string> = {};
    if (!$config) return result;
    for (const s of $config.sections) {
      if (s.calc.type === 'filterSum') {
        result[s.id] = describeFilter(s.calc.filter, $config!);
      }
    }
    return result;
  });

  let saving = $state(false);

  // ----- group editor -----
  interface GroupDraft {
    id?: string;
    name: string;
    kind: SectionGroupKind;
  }
  let editingGroup = $state<GroupDraft | null>(null);
  let groupModalOpen = $state(false);

  // Closing a modal (backdrop / Esc / X) clears its draft.
  $effect(() => {
    if (!groupModalOpen) editingGroup = null;
  });

  function newGroup() {
    editingGroup = { name: '', kind: 'distribution' };
    groupModalOpen = true;
  }
  function editGroup(g: SectionGroup) {
    editingGroup = { id: g.id, name: g.name, kind: g.kind };
    groupModalOpen = true;
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
    groupModalOpen = false;
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
    startDate: string;
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
  let sectionModalOpen = $state(false);

  $effect(() => {
    if (!sectionModalOpen) editingSection = null;
  });

  const blankSection = (groupId: string): SectionDraft => ({
    groupId,
    name: '',
    color: '#0DA882',
    calcType: 'percentage',
    percent: 10,
    amountMajor: 0,
    targetMajor: 0,
    targetDate: '',
    startDate: '',
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
    editingSection = blankSection(groupId);
    sectionModalOpen = true;
  }

  /** Look up a section by id (from a distribution/goal row) and open its editor. */
  function editSectionById(id: string) {
    const s = ($config?.sections ?? []).find((x) => x.id === id);
    if (s) editSection(s);
  }

  function editSection(s: Section) {
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
      d.startDate = s.calc.startDate ?? '';
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
    sectionModalOpen = true;
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
          startDate: d.startDate || undefined,
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
    sectionModalOpen = false;
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

  /** Friendly word for a group's kind (avoid leaking the raw data value). */
  function groupKindLabel(kind: SectionGroupKind): string {
    return kind === 'distribution' ? 'Budget' : 'Goals';
  }

  // Option lists handed to each Select's `items` so the trigger shows the
  // friendly label right away; otherwise bits-ui shows the raw value (e.g.
  // "distribution", "none") until the dropdown has been opened once.
  const groupKindItems = [
    { value: 'distribution', label: 'Budget — split income into buckets' },
    { value: 'plain', label: 'Goals — track savings targets' }
  ];
  const scheduleItems = [
    { value: 'none', label: 'None' },
    { value: 'interval', label: 'Every N days' },
    { value: 'anniversary', label: 'Yearly (month / day)' }
  ];
  const poolItemsLinked = $derived([
    { value: '', label: 'Not linked — progress stays 0%' },
    ...($config?.assetPools ?? []).map((p) => ({ value: p.id, label: p.name }))
  ]);
  const poolItemsChoose = $derived([
    { value: '', label: 'Select a pool…' },
    ...($config?.assetPools ?? []).map((p) => ({ value: p.id, label: p.name }))
  ]);

  /** One-line explanation + example shown under the section Type select. */
  function calcTypeHint(t: CalcType): string {
    switch (t) {
      case 'percentage':
        return 'Sets aside a share of your income. Example: Savings = 20% of income.';
      case 'fixed':
        return 'A set amount every period, regardless of income. Example: Rent = €900.';
      case 'remainder':
        return "Absorbs all income left after the other buckets — keeps your budget at 100%.";
      case 'filterSum':
        return 'Adds up real transactions that match a filter, so you see actual vs planned. Example: Groceries.';
      case 'accountBalance':
        return 'Shows the live balance of an asset pool. Example: Cash buffer = your checking pool.';
      case 'target':
        return 'Track progress toward an amount. Link a pool for real progress; add a date to pace it.';
    }
  }

  /** Apply a starter template, then optionally open a section for editing. */
  async function useTemplate(t: PlanTemplate) {
    if (!$config) return;
    const built = t.build();
    await persist({
      sectionGroups: [...$config.sectionGroups, ...built.sectionGroups],
      sections: [...$config.sections, ...built.sections]
    });
    const openId = t.openSectionAfter?.(built);
    if (openId) {
      const s = built.sections.find((x) => x.id === openId);
      if (s) editSection(s);
    }
  }

</script>

<div class="mx-auto max-w-[860px] space-y-6 p-6">
  <!-- Header -->
  <div class="space-y-3">
    <div>
      <h1 class="text-lg font-semibold text-ink">Plan &amp; Goals</h1>
      <p class="mt-0.5 text-sm text-muted">
        Decide where your money goes each period, and track progress toward savings goals.
        Start from a template, or build your own.
      </p>
    </div>
    <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <!-- Month picker -->
      <div class="flex items-center justify-center gap-1 sm:justify-start">
        <Button variant="ghost" size="icon" class="h-7 w-7" onclick={prevMonth} title="Previous month">
          <CaretLeft class="h-4 w-4" />
        </Button>
        <span class="min-w-[8.5rem] text-center text-sm font-medium text-ink">
          {formatMonthLabel(selectedMonth, locale)}
        </span>
        <Button variant="ghost" size="icon" class="h-7 w-7" onclick={nextMonth} title="Next month">
          <CaretRight class="h-4 w-4" />
        </Button>
      </div>
      <Button class="shrink-0" onclick={newGroup}>
        <Plus class="h-4 w-4 shrink-0" /> New budget
      </Button>
    </div>
  </div>

  <!-- Group editor -->
  <Modal bind:open={groupModalOpen} title={editingGroup?.id ? 'Edit budget' : 'New budget'}>
    {#if editingGroup}
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Name</span>
          <Input type="text" bind:value={editingGroup.name} placeholder="e.g. Monthly plan" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">What is this?</span>
          <Select type="single" items={groupKindItems} value={editingGroup.kind} onValueChange={(v) => editingGroup && (editingGroup.kind = v as 'distribution' | 'plain')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {#each groupKindItems as it (it.value)}
                <SelectItem value={it.value} label={it.label} />
              {/each}
            </SelectContent>
          </Select>
          <span class="text-xs text-muted">
            {#if editingGroup.kind === 'distribution'}
              Splits your income across buckets and compares plan vs actual. Best for monthly budgeting.
            {:else}
              A simple list for savings goals — track how close you are to each target.
            {/if}
          </span>
        </label>
      </div>
      <div class="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onclick={() => (groupModalOpen = false)}>
          <X class="h-4 w-4" /> Cancel
        </Button>
        <Button onclick={saveGroup} disabled={saving || !editingGroup.name.trim()}>
          <Check class="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    {/if}
  </Modal>

  <!-- Section editor -->
  <Modal bind:open={sectionModalOpen} title={editingSection?.id ? 'Edit bucket or goal' : 'New bucket or goal'}>
    {#if editingSection}
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Name</span>
          <Input type="text" bind:value={editingSection.name} placeholder="e.g. Savings" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Color</span>
          <ColorField bind:value={editingSection.color} label="Bucket or goal color" block />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">How is this calculated?</span>
          <select
            bind:value={editingSection.calcType}
            class="h-9 w-full rounded-control border border-hairline bg-transparent px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <optgroup label="Allocate income">
              <option value="percentage">% of income</option>
              <option value="fixed">Fixed amount each period</option>
              <option value="remainder">Whatever's left over</option>
            </optgroup>
            <optgroup label="Track actuals">
              <option value="filterSum">Tracked spending (from transactions)</option>
              <option value="accountBalance">Account balance</option>
            </optgroup>
            <optgroup label="Goals">
              <option value="target">Savings goal</option>
            </optgroup>
          </select>
        </label>
        <p class="text-xs text-muted sm:col-span-2 -mt-2">{calcTypeHint(editingSection.calcType)}</p>
        <p class="text-xs text-muted/80 sm:col-span-2 -mt-2">
          “Allocate income” buckets are amounts you plan; “Track actuals” buckets are measured from
          your real transactions.
        </p>
        {#if (editingSection.calcType === 'percentage' || editingSection.calcType === 'remainder') && !hasIncome}
          <p class="text-xs text-warn sm:col-span-2 -mt-2">
            No income imported yet — this bucket will show 0 until you import transactions with income.
          </p>
        {/if}

        {#if editingSection.calcType === 'percentage'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Percent of income</span>
            <Input type="number" min="0" max="100" bind:value={editingSection.percent} />
          </label>
        {:else if editingSection.calcType === 'fixed'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Amount ({currency})</span>
            <Input type="number" min="0" step="0.01" bind:value={editingSection.amountMajor} />
          </label>
        {:else if editingSection.calcType === 'target'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Target amount ({currency})</span>
            <Input type="number" min="0" step="0.01" bind:value={editingSection.targetMajor} />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Target date (optional)</span>
            <DateField bind:value={editingSection.targetDate} clearable label="Target date" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs text-muted">Start date (optional — when you began saving; sets the on-track pace line)</span>
            <DateField bind:value={editingSection.startDate} clearable label="Start date" />
          </label>
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs text-muted">Track progress from (optional)</span>
            <Select type="single" items={poolItemsLinked} value={editingSection.assetPoolId} onValueChange={(v) => editingSection && (editingSection.assetPoolId = v)}>
              <SelectTrigger>
                <SelectValue placeholder="Not linked — progress stays 0%" />
              </SelectTrigger>
              <SelectContent>
                {#each poolItemsLinked as it (it.value)}
                  <SelectItem value={it.value} label={it.label} />
                {/each}
              </SelectContent>
            </Select>
            <span class="text-xs text-muted">
              Progress is read automatically from the linked pool's balance — there's no manual
              "I saved €X" entry. To track a goal, link a pool (set one up in Settings); otherwise
              it just shows the target.
            </span>
          </label>
        {:else if editingSection.calcType === 'accountBalance'}
          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs text-muted">Asset pool</span>
            {#if ($config?.assetPools ?? []).length > 0}
              <Select type="single" items={poolItemsChoose} value={editingSection.assetPoolId} onValueChange={(v) => editingSection && (editingSection.assetPoolId = v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pool…" />
                </SelectTrigger>
                <SelectContent>
                  {#each poolItemsChoose as it (it.value)}
                    <SelectItem value={it.value} label={it.label} />
                  {/each}
                </SelectContent>
              </Select>
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
                class="min-h-[5.5rem] rounded-control border border-hairline bg-transparent px-2 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            <Input type="number" min="0" step="0.01" bind:value={editingSection.plannedMajor} />
          </label>
          <details class="sm:col-span-2">
            <summary class="cursor-pointer text-xs text-muted hover:text-ink">More filters</summary>
            <div class="mt-3 grid gap-4 sm:grid-cols-2">
              {#if ($config?.accounts ?? []).length > 0}
                <label class="flex flex-col gap-1">
                  <span class="text-xs text-muted">Accounts</span>
                  <select multiple bind:value={editingSection.filterAccountIds} class="min-h-[4.5rem] rounded-control border border-hairline bg-transparent px-2 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {#each $config?.accounts ?? [] as a (a.id)}
                      <option value={a.id}>{a.name}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              {#if ($config?.tags ?? []).length > 0}
                <label class="flex flex-col gap-1">
                  <span class="text-xs text-muted">Tags</span>
                  <select multiple bind:value={editingSection.filterTagIds} class="min-h-[4.5rem] rounded-control border border-hairline bg-transparent px-2 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {#each $config?.tags ?? [] as t (t.id)}
                      <option value={t.id}>{t.name}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              <label class="flex flex-col gap-1 sm:col-span-2">
                <span class="text-xs text-muted">Label contains</span>
                <Input type="text" bind:value={editingSection.filterQuery} placeholder="e.g. groceries" />
              </label>
            </div>
          </details>
        {/if}

        <!-- Schedule (optional, applies to any section) -->
        <label class="flex flex-col gap-1 sm:col-span-2">
          <span class="text-xs text-muted">Schedule (optional)</span>
          <Select type="single" items={scheduleItems} value={editingSection.scheduleKind} onValueChange={(v) => editingSection && (editingSection.scheduleKind = v as 'none' | 'interval' | 'anniversary')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {#each scheduleItems as it (it.value)}
                <SelectItem value={it.value} label={it.label} />
              {/each}
            </SelectContent>
          </Select>
        </label>
        {#if editingSection.scheduleKind === 'interval'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Every (days)</span>
            <Input type="number" min="1" bind:value={editingSection.intervalEveryDays} />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Starting from</span>
            <DateField bind:value={editingSection.intervalAnchor} clearable label="Anchor date" />
          </label>
        {:else if editingSection.scheduleKind === 'anniversary'}
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Month (1–12)</span>
            <Input type="number" min="1" max="12" bind:value={editingSection.annivMonth} />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted">Day (1–31)</span>
            <Input type="number" min="1" max="31" bind:value={editingSection.annivDay} />
          </label>
        {/if}
      </div>
      <div class="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onclick={() => (sectionModalOpen = false)}>
          <X class="h-4 w-4" /> Cancel
        </Button>
        <Button
          onclick={saveSection}
          disabled={saving || !editingSection.name.trim() || (editingSection.calcType === 'target' && !(Number(editingSection.targetMajor) > 0)) || (editingSection.calcType === 'accountBalance' && !editingSection.assetPoolId)}
        >
          <Check class="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    {/if}
  </Modal>

  <!-- Empty state: template gallery -->
  {#if evaluated.length === 0}
    <div class="space-y-4 rounded-xl border border-dashed border-accent/30 bg-accent/5 p-6">
      <div class="text-center">
        <p class="text-base font-medium text-ink">Let's set up your plan</p>
        <p class="text-sm text-muted">Pick a starter template to get going in one click, or build your own.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each planTemplates as t (t.id)}
          <button
            class="press flex flex-col gap-1 rounded-xl border border-hairline bg-surface p-4 text-left hover:border-accent/50"
            onclick={() => useTemplate(t)}
          >
            <span class="text-sm font-medium text-ink">{t.title}</span>
            <span class="text-xs text-muted">{t.description}</span>
          </button>
        {/each}
      </div>
      <div class="text-center">
        <Button variant="link" class="h-auto p-0 text-sm font-medium" onclick={newGroup}>
          or build from scratch
        </Button>
      </div>
    </div>
  {/if}

  <!-- Groups -->
  {#each evaluated as ev (ev.group.id)}
    <Card>
      <div class="mb-4 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <h2 class="card-title truncate">{ev.group.name}</h2>
          <span class="text-xs text-muted">{groupKindLabel(ev.group.kind)}</span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" class="gap-1.5 px-2 sm:px-2.5" onclick={() => newSection(ev.group.id)} title={ev.group.kind === 'plain' ? 'Add goal' : 'Add bucket'} aria-label={ev.group.kind === 'plain' ? 'Add goal' : 'Add bucket'}>
            <Plus class="h-3.5 w-3.5" /> <span class="hidden sm:inline">{ev.group.kind === 'plain' ? 'Add goal' : 'Add bucket'}</span>
          </Button>
          <Button variant="ghost" size="icon" class="h-8 w-8 text-muted hover:text-ink" onclick={() => editGroup(ev.group)} title="Edit group">
            <PencilSimple class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" class="h-8 w-8 text-muted hover:bg-red-500/10 hover:text-red-500" onclick={() => deleteGroup(ev.group.id)} title="Delete group">
            <Trash class="h-4 w-4" />
          </Button>
        </div>
      </div>

      {#if ev.distribution.sections.length > 0}
        <DistributionView group={ev.distribution} {currency} {locale} {filterDescriptions} periodLabel={formatMonthLabel(selectedMonth, locale)} onEdit={editSectionById} onDelete={deleteSection} />
      {/if}

      {#if ev.targets.length > 0}
        <div class="mt-5">
          <h3 class="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"><Target class="h-4 w-4 text-accent" /> Goals</h3>
          <p class="mb-3 text-xs text-muted">The line on each bar marks where you'd be today to finish on time.</p>
          <TargetProgress items={ev.targets} {currency} {locale} onEdit={editSectionById} onDelete={deleteSection} />
        </div>
      {/if}

      {#if ev.distribution.sections.length === 0 && ev.targets.length === 0}
        <p class="text-sm text-muted">Nothing here yet — add a bucket or a goal.</p>
      {/if}
    </Card>
  {/each}
</div>
