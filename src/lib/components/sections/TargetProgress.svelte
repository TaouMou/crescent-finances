<script lang="ts">
  import { formatMoney } from '$lib/utils/currency';
  import { targetPace, type TargetPace } from '$lib/sections/engine';
  import type { TargetSection } from '$lib/seed/dashboard';

  let {
    items,
    currency = 'EUR',
    locale = 'en-US'
  }: { items: TargetSection[]; currency?: string; locale?: string } = $props();

  const fmt = (n: number) => formatMoney(n, { currency, locale, whole: true });

  const statusStyle: Record<TargetPace['status'], string> = {
    ahead: 'border-income/30 bg-income/10 text-income',
    done: 'border-income/30 bg-income/10 text-income',
    behind: 'border-warn/30 bg-warn/10 text-warn',
    onTrack: 'border-hairline bg-ink/5 text-muted',
    none: ''
  };
  const statusLabel: Record<TargetPace['status'], string> = {
    ahead: 'Ahead',
    done: 'Reached',
    behind: 'Behind',
    onTrack: 'On track',
    none: ''
  };

  const monthYear = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' });

  function view(t: TargetSection) {
    const pace = targetPace(t);
    return {
      pace,
      pct: Math.round(pace.progressFraction * 100),
      expectedPct: pace.expectedFraction == null ? null : Math.round(pace.expectedFraction * 100)
    };
  }
</script>

<div class="space-y-5">
  {#each items as t (t.id)}
    {@const v = view(t)}
    <div class="space-y-2">
      <div class="flex items-baseline justify-between gap-2">
        <span class="truncate text-sm text-ink">{t.name}</span>
        <div class="flex shrink-0 items-center gap-2">
          {#if v.pace.status !== 'none'}
            <span
              class={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle[v.pace.status]}`}
            >
              {statusLabel[v.pace.status]}
            </span>
          {/if}
          <span class="tnum text-sm font-medium text-ink">{v.pct}%</span>
        </div>
      </div>

      <!-- Progress fill with an on-track pace marker (where you'd be to land on time). -->
      <div class="relative h-2.5 rounded-full bg-ink/[0.06]">
        <div
          class="absolute inset-y-0 left-0 rounded-full"
          style={`width:${v.pct}%;background:${t.color};transition:width var(--dur-slow) var(--ease-out)`}
        ></div>
        {#if v.expectedPct != null}
          <div
            class="absolute -top-1 -bottom-1 w-[2px] rounded bg-ink/55"
            style={`left:${v.expectedPct}%`}
            title={`On-track pace · ${v.expectedPct}%`}
          ></div>
        {/if}
      </div>

      <!-- Progress on the left, the one actionable number on the right. -->
      <div class="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span class="tnum truncate">{fmt(t.current)} of {fmt(t.target)}</span>
        {#if t.targetDate && v.pace.perMonthNeeded != null && v.pace.toGo > 0}
          <span class="tnum shrink-0">{fmt(v.pace.perMonthNeeded)}/mo · {monthYear(t.targetDate)}</span>
        {:else if v.pace.toGo > 0}
          <span class="tnum shrink-0">{fmt(v.pace.toGo)} to go</span>
        {/if}
      </div>
    </div>
  {/each}
</div>
