<script lang="ts">
  import CountUp from '$lib/components/ui/CountUp.svelte';
  import { formatMoney } from '$lib/utils/currency';
  import { liquidBalance } from '$lib/aggregations';
  import { transactions } from '$lib/stores/transactions';
  import { balances } from '$lib/stores/balances';
  import { config } from '$lib/stores/config';
  import { demoMode } from '$lib/stores/demo';
  import { demoCurrency, demoLocale, summary as demoSummary } from '$lib/seed/dashboard';

  const txAll = transactions.all;

  $effect(() => {
    balances.load();
  });

  const currency = $derived($config?.meta?.currency ?? demoCurrency);
  const locale = $derived($config?.meta?.locale ?? demoLocale);
  const hasData = $derived($txAll.length > 0);
  const showDemo = $derived($demoMode && !hasData);

  const fmt = $derived((n: number) =>
    formatMoney(n, { currency, locale, signed: false, whole: true })
  );

  const liquid = $derived.by(() => {
    if (showDemo) return demoSummary.liquidBalance;
    return liquidBalance($txAll, $balances);
  });
</script>

<!-- Hero balance card — bank-app style, single focus -->
<div class="relative overflow-hidden rounded-2xl bg-accent px-6 py-12 sm:py-16">
  <!-- Decorative depth circles (top-right, bottom-left, small accent) -->
  <div class="pointer-events-none absolute -right-14 -top-14 h-56 w-56 rounded-full bg-white/[0.07]"></div>
  <div class="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/[0.06]"></div>
  <div class="pointer-events-none absolute bottom-4 right-28 h-20 w-20 rounded-full bg-white/[0.04]"></div>

  <div class="relative flex flex-col items-center gap-4 text-center">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Liquid Balance</p>

    <CountUp
      value={liquid}
      format={fmt}
      class="tnum block text-4xl font-extrabold leading-none tracking-tight text-white sm:text-5xl"
    />

    <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white/90">
      <span class="h-1.5 w-1.5 rounded-full bg-white/80"></span>
      Now
    </span>
  </div>
</div>
