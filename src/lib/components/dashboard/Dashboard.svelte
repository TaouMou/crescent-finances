<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import SummaryCards from './SummaryCards.svelte';
  import AnomaliesList from './AnomaliesList.svelte';
  import SpendingByCategory from '$lib/components/charts/SpendingByCategory.svelte';
  import NetOverTime from '$lib/components/charts/NetOverTime.svelte';
  import DistributionView from '$lib/components/sections/DistributionView.svelte';
  import TargetProgress from '$lib/components/sections/TargetProgress.svelte';
  import {
    spendingByCategory,
    netSeries,
    anomalies,
    distribution,
    targets,
    demoCurrency,
    demoLocale
  } from '$lib/seed/dashboard';
</script>

<div class="mx-auto max-w-[1180px] space-y-5 p-6">
  <SummaryCards />

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <!-- Main column -->
    <div class="space-y-5 lg:col-span-2">
      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">Net over time</h2>
          <span class="text-xs text-muted">Last 12 months</span>
        </div>
        <NetOverTime data={netSeries} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">Spending by category</h2>
          <span class="text-xs text-muted">June 2026</span>
        </div>
        <SpendingByCategory data={spendingByCategory} currency={demoCurrency} locale={demoLocale} />
      </Card>
    </div>

    <!-- Side column -->
    <div class="space-y-5">
      <Card class="ring-accent/20">
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">{distribution.name}</h2>
          <span class="text-xs text-muted">Distribution</span>
        </div>
        <DistributionView group={distribution} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">Goals</h2>
          <span class="text-xs text-muted">Targets</span>
        </div>
        <TargetProgress items={targets} currency={demoCurrency} locale={demoLocale} />
      </Card>

      <Card>
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="text-sm font-medium text-ink">Anomalies</h2>
          <span class="text-xs text-muted">This period</span>
        </div>
        <AnomaliesList data={anomalies} />
      </Card>
    </div>
  </div>
</div>
