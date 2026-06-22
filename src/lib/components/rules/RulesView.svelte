<script lang="ts">
  import { Plus, Trash, PencilSimple, Check, Play } from 'phosphor-svelte';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
  import { cn } from '$lib/utils/cn';
  import type { Rule } from '$lib/types';
  import { describeMatch, describeActions } from '$lib/rules/describe';
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

  let saving = $state(false);
  let applyStatus = $state<string | null>(null);

  // ----- inline editor -----
  type DraftRule = Omit<Rule, 'id'> & { id?: string };

  const blankDraft = (): DraftRule => ({
    priority: 10,
    enabled: true,
    match: { field: 'label', type: 'keyword', value: '', caseSensitive: false },
    setCategoryId: undefined,
    setEntity: undefined,
    addTagIds: []
  });

  let editing = $state<DraftRule | null>(null);
  let editingId = $state<string | null>(null);
  let modalOpen = $state(false);

  $effect(() => {
    if (!modalOpen) {
      editing = null;
      editingId = null;
    }
  });

  function startNew() {
    editingId = null;
    editing = blankDraft();
    modalOpen = true;
  }

  function startEdit(rule: Rule) {
    editingId = rule.id;
    editing = { ...rule, addTagIds: [...(rule.addTagIds ?? [])] };
    modalOpen = true;
  }

  function cancelEdit() {
    modalOpen = false;
  }

  async function saveRule() {
    if (!editing || !$config) return;
    const draft = editing;
    if (!draft.match.value.trim()) return;

    const rules = [...($config.rules ?? [])];
    if (editingId) {
      const idx = rules.findIndex((r) => r.id === editingId);
      if (idx >= 0) rules[idx] = { ...draft, id: editingId } as Rule;
    } else {
      const id = crypto.randomUUID();
      rules.push({ ...draft, id } as Rule);
    }
    saving = true;
    await config.save({ ...$config, rules });
    saving = false;
    modalOpen = false;
  }

  async function deleteRule(id: string) {
    if (!$config) return;
    const rules = ($config.rules ?? []).filter((r) => r.id !== id);
    await config.save({ ...$config, rules });
  }

  async function toggleEnabled(rule: Rule) {
    if (!$config) return;
    const rules = ($config.rules ?? []).map((r) =>
      r.id === rule.id ? { ...r, enabled: !r.enabled } : r
    );
    await config.save({ ...$config, rules });
  }

  async function applyRulesNow() {
    if (!$config) return;
    applyStatus = 'Applying…';
    const changed = await transactions.applyAndSave($config);
    applyStatus = `Done — ${changed} transaction${changed !== 1 ? 's' : ''} updated.`;
    setTimeout(() => (applyStatus = null), 4000);
  }

  const sortedRules = $derived(
    [...($config?.rules ?? [])].sort((a, b) => a.priority - b.priority)
  );

  const categories = $derived($config?.categories ?? []);
  const tags = $derived($config?.tags ?? []);

  // Option lists passed to each Select's `items` so the trigger can show the
  // friendly label before the (portaled) dropdown has mounted — otherwise
  // bits-ui falls back to the raw value (e.g. "label", "keyword").
  const matchFieldItems = [
    { value: 'label', label: 'Description' },
    { value: 'entity', label: 'Entity' }
  ];
  const matchTypeItems = [
    { value: 'keyword', label: 'Contains keyword' },
    { value: 'regex', label: 'Regex pattern' }
  ];
  const categoryItems = $derived([
    { value: '', label: '— no change —' },
    ...categories.map((c) => ({ value: c.id, label: c.name }))
  ]);
</script>

<div class="mx-auto max-w-[860px] space-y-6 p-6">
  <!-- Header -->
  <div class="space-y-3">
    <div>
      <h1 class="text-lg font-semibold text-ink">Rules</h1>
      <p class="mt-0.5 text-sm text-muted">
        Fill in details automatically: match a transaction's description or merchant, then set a
        category, rename the merchant, or add tags. Rules run in priority order (lower number =
        first).
      </p>
      <p class="mt-1 text-xs text-muted">
        Example: when the description contains <code class="rounded bg-ink/8 px-1 py-0.5">ALDI</code>
        → set category Groceries.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button variant="outline" onclick={applyRulesNow} title="Re-apply all rules to stored transactions">
        <Play class="h-4 w-4" />
        Apply now
      </Button>
      <Button onclick={startNew}>
        <Plus class="h-4 w-4" />
        New rule
      </Button>
      {#if applyStatus}
        <span class="text-xs text-muted">{applyStatus}</span>
      {/if}
    </div>
  </div>

  <!-- Rule editor modal -->
  <Modal bind:open={modalOpen} title={editingId ? 'Edit rule' : 'New rule'}>
    {#if editing}
      <div class="grid gap-4 sm:grid-cols-2">
        <!-- Priority -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Priority</span>
          <Input
            type="number"
            min="1"
            bind:value={editing.priority}
          />
        </label>

        <!-- Field -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Match field</span>
          <Select
            type="single"
            items={matchFieldItems}
            value={editing.match.field}
            onValueChange={(v) => editing && (editing.match.field = v as 'label' | 'entity')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {#each matchFieldItems as it (it.value)}
                <SelectItem value={it.value} label={it.label} />
              {/each}
            </SelectContent>
          </Select>
        </label>

        <!-- Match type -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Match type</span>
          <Select
            type="single"
            items={matchTypeItems}
            value={editing.match.type}
            onValueChange={(v) => editing && (editing.match.type = v as 'keyword' | 'regex')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {#each matchTypeItems as it (it.value)}
                <SelectItem value={it.value} label={it.label} />
              {/each}
            </SelectContent>
          </Select>
        </label>

        <!-- Value -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Value</span>
          <Input
            type="text"
            bind:value={editing.match.value}
            placeholder={editing.match.type === 'keyword' ? 'e.g. ALDI' : 'e.g. ^NETFLIX'}
          />
        </label>

        <!-- Category -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Set category</span>
          <Select
            type="single"
            items={categoryItems}
            value={editing.setCategoryId ?? ''}
            onValueChange={(v) => editing && (editing.setCategoryId = v || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="— no change —" />
            </SelectTrigger>
            <SelectContent>
              {#each categoryItems as it (it.value)}
                <SelectItem value={it.value} label={it.label} />
              {/each}
            </SelectContent>
          </Select>
        </label>

        <!-- Entity -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Set entity label</span>
          <Input
            type="text"
            bind:value={editing.setEntity}
            placeholder="e.g. Aldi"
          />
        </label>

        <!-- Add tags -->
        {#if tags.length > 0}
          <div class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-xs text-muted">Add tags</span>
            <div class="flex flex-wrap gap-x-5 gap-y-2 rounded-control border border-hairline bg-surface px-3 py-2.5">
              {#each tags as tag (tag.id)}
                <label class="flex cursor-pointer items-center gap-1.5 text-sm text-ink select-none">
                  <input
                    type="checkbox"
                    checked={editing.addTagIds?.includes(tag.id) ?? false}
                    onchange={(e) => {
                      if (!editing) return;
                      const ids = new Set(editing.addTagIds ?? []);
                      if (e.currentTarget.checked) ids.add(tag.id); else ids.delete(tag.id);
                      editing.addTagIds = [...ids];
                    }}
                  />
                  <span class="h-2 w-2 shrink-0 rounded-full" style={`background:${tag.color}`}></span>
                  {tag.name}
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Case sensitive -->
      <label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
        <input type="checkbox" bind:checked={editing.match.caseSensitive} class="rounded" />
        Case sensitive
      </label>

      <!-- Actions -->
      <div class="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onclick={cancelEdit}>Cancel</Button>
        <Button
          onclick={saveRule}
          disabled={saving || !editing.match.value.trim()}
        >
          <Check class="h-4 w-4" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    {/if}
  </Modal>

  <!-- Rules list -->
  {#if sortedRules.length === 0}
    <div class="rounded-xl border border-hairline bg-surface/50 py-16 text-center">
      <p class="text-sm text-muted">No rules yet. Create one to start auto-categorizing transactions.</p>
    </div>
  {:else if sortedRules.length > 0}
    <div class="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
      {#each sortedRules as rule (rule.id)}
        <div class={cn(
          'grid grid-cols-[auto_1fr_auto] items-center gap-x-3 px-4 py-3',
          'sm:flex sm:gap-4 sm:py-3.5',
          !rule.enabled && 'opacity-50'
        )}>
          <!-- Priority: desktop only -->
          <span class="hidden sm:block w-6 shrink-0 text-center text-xs font-medium text-muted">{rule.priority}</span>

          <!-- Toggle: spans both rows on mobile -->
          <button
            class={cn(
              'row-span-2 group relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-[var(--ease-out)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              rule.enabled ? 'bg-accent' : 'bg-ink/20 hover:bg-ink/25'
            )}
            onclick={() => toggleEnabled(rule)}
            aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
            aria-pressed={rule.enabled}
            title={rule.enabled ? 'Disable' : 'Enable'}
          >
            <span
              class={cn(
                'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-out)]',
                'group-active:scale-90',
                rule.enabled ? 'translate-x-4' : 'translate-x-0'
              )}
            ></span>
          </button>

          <!-- Primary text -->
          <p class="min-w-0 truncate text-sm text-ink">
            <span class="text-[11px] font-medium text-muted sm:hidden">{rule.priority} · </span>
            <span class="text-muted">{describeMatch(rule)}</span>
            {' '}<code class="rounded bg-ink/8 px-1 py-0.5 text-xs">{rule.match.value}</code>
            {#if !rule.match.caseSensitive}
              <span class="hidden text-xs text-muted sm:inline"> (case-insensitive)</span>
            {/if}
          </p>

          <!-- Edit / delete: spans both rows on mobile -->
          <div class="row-span-2 flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onclick={() => startEdit(rule)}
              title="Edit"
            >
              <PencilSimple class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="text-muted hover:bg-red-500/10 hover:text-red-500"
              onclick={() => deleteRule(rule.id)}
              title="Delete"
            >
              <Trash class="h-4 w-4" />
            </Button>
          </div>

          <!-- Secondary text: second row on mobile, inline on desktop -->
          <p class="min-w-0 truncate text-xs text-muted sm:hidden">
            {describeActions(rule, categories, tags)}
          </p>

          <!-- Secondary text: desktop only (flex sibling) -->
          <p class="hidden min-w-0 flex-1 truncate text-xs text-muted sm:block">
            {describeActions(rule, categories, tags)}
          </p>
        </div>
      {/each}
    </div>
  {/if}
</div>
