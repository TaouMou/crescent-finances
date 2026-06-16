/**
 * Seed data for the M0 dashboard render only. This is illustrative display data,
 * NOT a built-in configuration — the shipped app has zero predefined sections.
 * Amounts are integer minor units (cents). Currency/locale are demo values.
 */

export const demoCurrency = 'EUR';
export const demoLocale = 'en-US';

export interface SummaryStat {
  income: number;
  spending: number;
  net: number;
  liquidBalance: number;
}

export const summary: SummaryStat = {
  income: 412_000,
  spending: 268_450,
  net: 143_550,
  liquidBalance: 1_864_200
};

export interface CategorySpend {
  name: string;
  color: string;
  amount: number;
}

/** Colors are user-defined per category; these are demo values. */
export const spendingByCategory: CategorySpend[] = [
  { name: 'Groceries', color: '#14776B', amount: 78_200 },
  { name: 'Rent', color: '#3D6B7A', amount: 95_000 },
  { name: 'Transport', color: '#7A8B5A', amount: 31_400 },
  { name: 'Dining', color: '#A8703E', amount: 27_650 },
  { name: 'Utilities', color: '#6E7A82', amount: 21_300 },
  { name: 'Other', color: '#9A9FA5', amount: 14_900 }
];

export interface NetPoint {
  t: number; // epoch seconds (month)
  value: number; // cumulative net, minor units
}

/** 12 months of cumulative net for the line chart. */
export const netSeries: NetPoint[] = (() => {
  const monthlyNet = [82_300, 91_400, 64_800, 118_200, 73_500, 96_100, 142_900, 88_600, 109_400, 71_200, 131_000, 143_550];
  let cum = 980_000;
  return monthlyNet.map((m, i) => {
    cum += m;
    const d = new Date(Date.UTC(2025, 6 + i, 1));
    return { t: Math.floor(d.getTime() / 1000), value: cum };
  });
})();

export interface AnomalyFlag {
  id: string;
  category: string;
  message: string;
  deltaPct: number;
}

export const anomalies: AnomalyFlag[] = [
  { id: 'a1', category: 'Dining', message: 'Dining 62% above your 6-month norm', deltaPct: 62 },
  { id: 'a2', category: 'Transport', message: 'Transport 38% above your 6-month norm', deltaPct: 38 }
];

export type SectionKind = 'percentage' | 'fixed' | 'remainder' | 'target' | 'filterSum';

export interface DistributionSection {
  id: string;
  name: string;
  color: string;
  kind: SectionKind;
  /** Planned share of the source, in percent (for distribution groups). */
  plannedPct?: number;
  /** Planned absolute amount, minor units. */
  planned: number;
  /** Actual amount realised, minor units. */
  actual: number;
}

export interface DistributionGroup {
  id: string;
  name: string;
  source: string; // human label of the source, e.g. "Income"
  total: number; // source amount, minor units
  sections: DistributionSection[];
}

/** A neutral example distribution: income split into three user-named sections. */
export const distribution: DistributionGroup = {
  id: 'g1',
  name: 'Monthly plan',
  source: 'Income',
  total: summary.income,
  sections: [
    { id: 's1', name: 'Savings', color: '#14776B', kind: 'percentage', plannedPct: 30, planned: 123_600, actual: 123_600 },
    { id: 's2', name: 'Investing', color: '#3D6B7A', kind: 'percentage', plannedPct: 20, planned: 82_400, actual: 70_000 },
    { id: 's3', name: 'Spending', color: '#A8703E', kind: 'remainder', plannedPct: 50, planned: 206_000, actual: 268_450 }
  ]
};

export interface TargetSection {
  id: string;
  name: string;
  color: string;
  current: number;
  target: number;
  targetDate?: string;
}

export const targets: TargetSection[] = [
  { id: 't1', name: 'Emergency fund', color: '#14776B', current: 540_000, target: 800_000, targetDate: '2026-12-01' }
];

import type { MonthlyNet } from '$lib/aggregations';

const _incomes =   [320_000, 330_000, 315_000, 400_000, 325_000, 340_000, 450_000, 335_000, 380_000, 320_000, 410_000, 412_000];
const _spendings = [237_700, 238_600, 250_200, 281_800, 251_500, 243_900, 307_100, 246_400, 270_600, 248_800, 279_000, 268_450];

export const demoMonthly: MonthlyNet[] = (() => {
  let cumulative = 980_000;
  return _incomes.map((income, i) => {
    const spending = _spendings[i];
    const net = income - spending;
    cumulative += net;
    const year = 2025 + Math.floor((6 + i) / 12);
    const month = String(((6 + i) % 12) + 1).padStart(2, '0');
    return { bucket: `${year}-${month}`, income, spending, net, cumulative };
  });
})().reverse();
