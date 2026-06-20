<script lang="ts">
  import { Funnel, PencilSimple, Trash, Info, CheckCircle, Warning } from 'phosphor-svelte';
  import { formatMoney, formatPercent } from '$lib/utils/currency';
  import type { DistributionGroup, DistributionSection } from '$lib/seed/dashboard';

  let {
    group,
    currency = 'EUR',
    locale = 'en-US',
    filterDescriptions = {},
    periodLabel,
    onEdit,
    onDelete
  }: {
    group: DistributionGroup;
    currency?: string;
    locale?: string;
    /** Optional map of section id → human-readable filter label for filterSum sections. */
    filterDescriptions?: Record<string, string>;
    /** Concrete period name (e.g. "June 2026") shown beside the income; falls back to "this period". */
    periodLabel?: string;
    /** When provided, each row shows an edit button wired to the section id. */
    onEdit?: (id: string) => void;
    /** When provided, each row shows a delete button wired to the section id. */
    onDelete?: (id: string) => void;
  } = $props();

  const fmt = (n: number) => formatMoney(n, { currency, locale });

  const plannedTotal = $derived(group.sections.reduce((s, x) => s + x.planned, 0));

  // Beginner-friendly allocation status: is every euro of income assigned to a
  // bucket? Derived from real planned amounts — so a `remainder` bucket correctly
  // reads as fully assigned — rather than the percentage sum. Sub-€0.50 rounding
  // noise is ignored so the plan doesn't nag about a stray cent.
  const allocation = $derived.by(() => {
    if (group.total <= 0) return null;
    const leftover = group.total - plannedTotal;
    if (leftover > 50) return { tone: 'text-warn', icon: Info, text: `${fmt(leftover)} left to assign` };
    if (leftover < -50) return { tone: 'text-expense', icon: Warning, text: `Over budget by ${fmt(-leftover)}` };
    return { tone: 'text-income', icon: CheckCircle, text: 'All income assigned' };
  });

  // One shared scale across the rows so every bullet is comparable at a glance.
  const scale = $derived(Math.max(1, ...group.sections.map((s) => Math.max(s.planned, s.actual))));
  const w = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`;

  // Polarity-aware delta: for a spending bucket (lowerIsBetter) over plan is bad;
  // for a savings/investing bucket (higherIsBetter) over plan is good.
  function meta(s: DistributionSection) {
    const delta = s.actual - s.planned; // + = over plan
    const over = delta > 0;
    const higherIsBetter = s.direction === 'higherIsBetter';
    const good = delta === 0 ? null : over === higherIsBetter;
    const label = delta === 0 ? 'on plan' : `${fmt(Math.abs(delta))} ${over ? 'over' : 'under'}`;
    const tone = good === null ? 'text-muted' : good ? 'text-income' : 'text-expense';
    // Overflow segment colour when actual exceeds plan. Tokens are space-separated
    // RGB channels, so they must be wrapped in rgb() to be a valid background.
    const overflow = over ? (good ? 'rgb(var(--c-income))' : 'rgb(var(--c-expense))') : null;
    return { delta, over, good, label, tone, overflow };
  }
</script>

<div class="space-y-5">
  <div class="space-y-1">
    <p class="flex items-center gap-1 text-sm text-muted">
      {group.source}{periodLabel ? ` · ${periodLabel}` : ' this period'}
      <span
        class="inline-flex cursor-help text-muted/70"
        title={`Your imported income for ${periodLabel ?? 'the selected period'} — the amount divided across the buckets below.`}
      >
        <Info class="h-3.5 w-3.5 shrink-0" />
      </span>
    </p>
    <p class="tnum text-xl font-medium text-ink">{fmt(group.total)}</p>
    {#if allocation}
      {@const Icon = allocation.icon}
      <p class={`flex items-center gap-1 text-xs ${allocation.tone}`}>
        <Icon class="h-3.5 w-3.5 shrink-0" weight="fill" />
        {allocation.text}
      </p>
    {/if}
  </div>

  <!-- Planned allocation: how the source splits across sections (the plan). -->
  <div class="space-y-1.5">
    <div class="flex justify-between text-xs text-muted">
      <span>Planned allocation</span>
      <span class="tnum">{fmt(plannedTotal)}</span>
    </div>
    <div class="flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
      {#each group.sections as s (s.id)}
        <div
          class="h-full first:rounded-l-full last:rounded-r-full"
          style={`flex:${Math.max(s.planned, 0)} 0 0;background:${s.color};transition:flex-grow var(--dur-slow) var(--ease-out)`}
          title={`${s.name} · ${fmt(s.planned)}`}
        ></div>
      {/each}
    </div>
  </div>

  <!-- Per-section bullets: actual measured against its planned target. -->
  <ul class="space-y-3.5">
    {#each group.sections as s (s.id)}
      {@const m = meta(s)}
      <li class="space-y-1.5">
        <!-- Header — desktop: name + amount + delta + actions on one line -->
        <div class="hidden items-baseline justify-between gap-3 sm:flex">
          <div class="flex min-w-0 items-center gap-2">
            <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={`background:${s.color}`}></span>
            <span class="truncate text-sm text-ink">{s.name}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <div class="flex items-baseline gap-2">
              <span class="tnum text-sm text-ink">{fmt(s.actual)}</span>
              <span class={`tnum text-xs ${m.tone}`}>{m.label}</span>
            </div>
            {#if onEdit || onDelete}
              <div class="-my-1 flex items-center gap-0.5">
                {#if onEdit}
                  <button class="press grid h-7 w-7 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={() => onEdit?.(s.id)} title="Edit bucket">
                    <PencilSimple class="h-3.5 w-3.5" />
                  </button>
                {/if}
                {#if onDelete}
                  <button class="press grid h-7 w-7 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20" onclick={() => onDelete?.(s.id)} title="Delete bucket">
                    <Trash class="h-3.5 w-3.5" />
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Header — mobile: name + amount only (delta shown below; actions move to meta) -->
        <div class="flex items-baseline justify-between gap-2 sm:hidden">
          <div class="flex min-w-0 items-center gap-2">
            <span class="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={`background:${s.color}`}></span>
            <span class="truncate text-sm text-ink">{s.name}</span>
          </div>
          <div class="flex shrink-0 items-baseline gap-2">
            <span class="tnum text-sm text-ink">{fmt(s.actual)}</span>
            {#if m.delta !== 0}
              <span class={`tnum text-xs ${m.tone}`}>{m.label}</span>
            {/if}
          </div>
        </div>

        <!-- Bullet: track · actual fill (capped at plan) · overflow cap · planned tick -->
        <div class="relative h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
          <div
            class={`absolute inset-y-0 left-0 rounded-l-full ${m.overflow ? '' : 'rounded-r-full'}`}
            style={`width:${w(Math.min(s.actual, s.planned || s.actual))};background:${s.color};transition:width var(--dur-slow) var(--ease-out)`}
          ></div>
          {#if m.overflow}
            <div
              class="absolute inset-y-0 rounded-r-full"
              style={`left:${w(s.planned)};width:${w(s.actual - s.planned)};background:${m.overflow}`}
            ></div>
          {/if}
          {#if s.planned > 0}
            <div
              class="absolute inset-y-0 w-[2px] bg-ink/45"
              style={`left:${w(s.planned)}`}
              title={`Planned · ${fmt(s.planned)}`}
            ></div>
          {/if}
        </div>

        <!-- Meta: plan/% on the left; on mobile the edit/delete actions sit here. -->
        <div class="flex items-center justify-between gap-2">
          <p class="min-w-0 truncate text-xs text-muted">
            Plan {fmt(s.planned)}{#if s.kind === 'remainder'}&nbsp;· remainder{:else if s.plannedPct != null}&nbsp;·
              {formatPercent(s.plannedPct, locale)} of {group.source.toLowerCase()}{/if}
          </p>
          {#if onEdit || onDelete}
            <div class="-my-1 flex shrink-0 items-center gap-0.5 sm:hidden">
              {#if onEdit}
                <button class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10" onclick={() => onEdit?.(s.id)} title="Edit bucket" aria-label="Edit {s.name}">
                  <PencilSimple class="h-4 w-4" />
                </button>
              {/if}
              {#if onDelete}
                <button class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-red-500/10 hover:text-red-500 active:bg-red-500/20" onclick={() => onDelete?.(s.id)} title="Delete bucket" aria-label="Delete {s.name}">
                  <Trash class="h-4 w-4" />
                </button>
              {/if}
            </div>
          {/if}
        </div>

        {#if s.kind === 'filterSum' && filterDescriptions[s.id]}
          <div
            class="relative mt-1.5 flex items-center gap-1.5 overflow-hidden rounded-[5px] px-2.5 py-1"
            style={`border:1px solid ${s.color}33;background:${s.color}0d`}
          >
            <div
              class="pointer-events-none absolute inset-y-0 left-0 w-20 blur-[6px]"
              style={`background:radial-gradient(80% 150% at 0% 50%, ${s.color}55, transparent 80%)`}
            ></div>
            <Funnel color={s.color} class="relative h-3 w-3 shrink-0" />
            <span class="relative truncate text-[11px] text-muted">{filterDescriptions[s.id]}</span>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</div>
