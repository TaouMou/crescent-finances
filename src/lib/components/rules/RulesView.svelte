<script lang="ts">
  import { Plus, Trash, PencilSimple, Check, Play } from 'phosphor-svelte';
  import { config } from '$lib/stores/config';
  import { transactions } from '$lib/stores/transactions';
  import { cn } from '$lib/utils/cn';
  import type { Rule, RuleMatch } from '$lib/types';
  import Modal from '$lib/components/ui/Modal.svelte';

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

  function fieldLabel(f: RuleMatch['field']) {
    return f === 'label' ? 'Description' : 'Entity';
  }
  function typeLabel(t: RuleMatch['type']) {
    return t === 'keyword' ? 'contains' : 'matches regex';
  }
</script>

<div class="mx-auto max-w-[860px] space-y-6 p-6">
  <!-- Header -->
  <div class="space-y-3">
    <div>
      <h1 class="text-lg font-semibold text-ink">Rules</h1>
      <p class="mt-0.5 text-sm text-muted">
        Auto-categorize transactions on import or on demand.
        Rules run in priority order (lower number = first).
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        class="press flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        onclick={applyRulesNow}
        title="Re-apply all rules to stored transactions"
      >
        <Play class="h-4 w-4" />
        Apply now
      </button>
      <button
        class="press flex h-9 items-center gap-2 rounded-control bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80"
        onclick={startNew}
      >
        <Plus class="h-4 w-4" />
        New rule
      </button>
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
          <input
            type="number"
            min="1"
            bind:value={editing.priority}
            class="h-9 rounded-control border border-hairline bg-paper px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </label>

        <!-- Field -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Match field</span>
          <select
            bind:value={editing.match.field}
            class="h-9 rounded-control border border-hairline bg-paper px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="label">Description</option>
            <option value="entity">Entity</option>
          </select>
        </label>

        <!-- Match type -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Match type</span>
          <select
            bind:value={editing.match.type}
            class="h-9 rounded-control border border-hairline bg-paper px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value="keyword">Contains keyword</option>
            <option value="regex">Regex pattern</option>
          </select>
        </label>

        <!-- Value -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Value</span>
          <input
            type="text"
            bind:value={editing.match.value}
            placeholder={editing.match.type === 'keyword' ? 'e.g. ALDI' : 'e.g. ^NETFLIX'}
            class="h-9 rounded-control border border-hairline bg-paper px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </label>

        <!-- Category -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Set category</span>
          <select
            bind:value={editing.setCategoryId}
            class="h-9 rounded-control border border-hairline bg-paper px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            <option value={undefined}>— no change —</option>
            {#each categories as cat (cat.id)}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
        </label>

        <!-- Entity -->
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted">Set entity label</span>
          <input
            type="text"
            bind:value={editing.setEntity}
            placeholder="e.g. Aldi"
            class="h-9 rounded-control border border-hairline bg-paper px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </label>
      </div>

      <!-- Case sensitive -->
      <label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
        <input type="checkbox" bind:checked={editing.match.caseSensitive} class="rounded" />
        Case sensitive
      </label>

      <!-- Actions -->
      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          class="press flex h-9 items-center gap-1.5 rounded-control px-3 text-sm text-muted hover:bg-ink/5 active:bg-ink/10"
          onclick={cancelEdit}
        >
          Cancel
        </button>
        <button
          class="press flex h-9 items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50"
          onclick={saveRule}
          disabled={saving || !editing.match.value.trim()}
        >
          <Check class="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
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
        <div class={cn('flex items-center gap-4 px-4 py-3.5', !rule.enabled && 'opacity-50')}>
          <!-- Priority badge -->
          <span class="w-6 shrink-0 text-center text-xs font-medium text-muted">{rule.priority}</span>

          <!-- Toggle -->
          <button
            class={cn(
              'relative h-5 w-9 shrink-0 rounded-full transition-colors',
              rule.enabled ? 'bg-accent' : 'bg-ink/20'
            )}
            onclick={() => toggleEnabled(rule)}
            aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
            title={rule.enabled ? 'Disable' : 'Enable'}
          >
            <span
              class={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
              )}
            ></span>
          </button>

          <!-- Description -->
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-ink">
              <span class="text-muted">{fieldLabel(rule.match.field)}</span>
              {' '}
              <span class="italic">{typeLabel(rule.match.type)}</span>
              {' '}
              <code class="rounded bg-ink/8 px-1 py-0.5 text-xs">{rule.match.value}</code>
              {#if !rule.match.caseSensitive}
                <span class="text-xs text-muted"> (case-insensitive)</span>
              {/if}
            </p>
            <p class="mt-0.5 truncate text-xs text-muted">
              {#if rule.setCategoryId}
                {@const cat = categories.find((c) => c.id === rule.setCategoryId)}
                Set category → {cat?.name ?? rule.setCategoryId}
              {/if}
              {#if rule.setEntity}
                {#if rule.setCategoryId} · {/if}
                Set entity → {rule.setEntity}
              {/if}
              {#if rule.addTagIds?.length}
                {#if rule.setCategoryId || rule.setEntity} · {/if}
                Add tags ({rule.addTagIds.length})
              {/if}
              {#if !rule.setCategoryId && !rule.setEntity && !rule.addTagIds?.length}
                (no actions)
              {/if}
            </p>
          </div>

          <!-- Edit / delete -->
          <div class="flex shrink-0 items-center gap-1">
            <button
              class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
              onclick={() => startEdit(rule)}
              title="Edit"
            >
              <PencilSimple class="h-4 w-4" />
            </button>
            <button
              class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20"
              onclick={() => deleteRule(rule.id)}
              title="Delete"
            >
              <Trash class="h-4 w-4" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
