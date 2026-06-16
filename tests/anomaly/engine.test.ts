import { describe, it, expect } from 'vitest';
import { detectAnomalies } from '../../src/lib/anomaly/engine';
import type { AnomalySettings, Category, Transaction } from '../../src/lib/types';

let seq = 0;
function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `tx${seq}`,
    fingerprint: `fp${seq}`,
    date: '2026-06-15',
    amount: -5000,
    label: 'X',
    normalizedLabel: 'x',
    accountId: null,
    categoryId: 'dining',
    entity: null,
    tagIds: [],
    importedAt: '2026-06-16T00:00:00Z',
    source: 'test.csv',
    ...overrides
  };
}

/** One expense tx per (month, amount) so buckets are easy to compose. */
function spend(month: string, amount: number, categoryId = 'dining'): Transaction {
  return makeTx({ date: `${month}-10`, amount: -amount, categoryId });
}

const categories: Category[] = [
  { id: 'dining', name: 'Dining', color: '#D4843A', parentId: null },
  { id: 'rent', name: 'Rent', color: '#2B8AB5', parentId: null }
];

const settings: AnomalySettings = { baselineMonths: 6, thresholdPct: 40, minAbsolute: 5000, madK: 3 };
const NOW = '2026-06';

describe('detectAnomalies', () => {
  it('flags a clear spike above a flat baseline', () => {
    const txs = [
      spend('2026-01', 10_000),
      spend('2026-02', 10_000),
      spend('2026-03', 10_000),
      spend('2026-04', 10_000),
      spend('2026-05', 10_000),
      spend('2026-06', 20_000) // current month: +100%
    ];
    const flags = detectAnomalies(txs, categories, settings, NOW);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ id: 'anomaly-dining', category: 'Dining', deltaPct: 100 });
    expect(flags[0].message).toBe('Dining 100% above your 6-month norm');
  });

  it('does not flag a spike below thresholdPct', () => {
    const txs = [
      spend('2026-01', 10_000),
      spend('2026-02', 10_000),
      spend('2026-03', 10_000),
      spend('2026-06', 12_000) // +20%, below 40%
    ];
    expect(detectAnomalies(txs, categories, settings, NOW)).toHaveLength(0);
  });

  it('does not flag when the absolute delta is below minAbsolute', () => {
    const txs = [
      spend('2026-01', 1000),
      spend('2026-02', 1000),
      spend('2026-03', 1000),
      spend('2026-06', 2000) // +100% but delta 1000 < 5000
    ];
    expect(detectAnomalies(txs, categories, settings, NOW)).toHaveLength(0);
  });

  it('a noisy baseline absorbs the spike via madK', () => {
    // Baseline 10k..50k → median 30k, MAD 10k, madK*MAD = 30k. current 50k:
    // delta 20k clears the pct/absolute floors but sits within the noise band.
    const txs = [
      spend('2026-01', 10_000),
      spend('2026-02', 20_000),
      spend('2026-03', 30_000),
      spend('2026-04', 40_000),
      spend('2026-05', 50_000),
      spend('2026-06', 50_000)
    ];
    expect(detectAnomalies(txs, categories, settings, NOW)).toHaveLength(0);
  });

  it('flags via fallback when MAD is 0 (perfectly flat baseline)', () => {
    const txs = [
      spend('2026-01', 10_000),
      spend('2026-02', 10_000),
      spend('2026-03', 10_000),
      spend('2026-06', 30_000)
    ];
    const flags = detectAnomalies(txs, categories, settings, NOW);
    expect(flags).toHaveLength(1);
    expect(flags[0].deltaPct).toBe(200);
  });

  it('flags a small-baseline category whose spend spikes hard', () => {
    const txs = [
      spend('2026-01', 100),
      spend('2026-02', 100),
      spend('2026-03', 100),
      spend('2026-06', 10_000) // delta ~9900 >= minAbsolute, pct huge
    ];
    const flags = detectAnomalies(txs, categories, settings, NOW);
    expect(flags).toHaveLength(1);
  });

  it('skips categories with insufficient history (< 3 baseline buckets)', () => {
    const txs = [
      spend('2026-04', 10_000),
      spend('2026-05', 10_000),
      spend('2026-06', 40_000)
    ];
    expect(detectAnomalies(txs, categories, settings, NOW)).toHaveLength(0);
  });

  it('never flags Uncategorized spending', () => {
    const txs = [
      spend('2026-01', 10_000, null as unknown as string),
      spend('2026-02', 10_000, null as unknown as string),
      spend('2026-03', 10_000, null as unknown as string),
      spend('2026-06', 50_000, null as unknown as string)
    ];
    expect(detectAnomalies(txs, categories, settings, NOW)).toHaveLength(0);
  });

  it('never flags income-only categories', () => {
    const txs = [
      makeTx({ date: '2026-01-10', amount: 10_000, categoryId: 'dining' }),
      makeTx({ date: '2026-02-10', amount: 10_000, categoryId: 'dining' }),
      makeTx({ date: '2026-03-10', amount: 10_000, categoryId: 'dining' }),
      makeTx({ date: '2026-06-10', amount: 50_000, categoryId: 'dining' })
    ];
    expect(detectAnomalies(txs, categories, settings, NOW)).toHaveLength(0);
  });

  it('sorts multiple flags by deltaPct descending', () => {
    const txs = [
      // dining: +100%
      spend('2026-01', 10_000),
      spend('2026-02', 10_000),
      spend('2026-03', 10_000),
      spend('2026-06', 20_000),
      // rent: +300%
      spend('2026-01', 10_000, 'rent'),
      spend('2026-02', 10_000, 'rent'),
      spend('2026-03', 10_000, 'rent'),
      spend('2026-06', 40_000, 'rent')
    ];
    const flags = detectAnomalies(txs, categories, settings, NOW);
    expect(flags.map((f) => f.category)).toEqual(['Rent', 'Dining']);
  });
});
