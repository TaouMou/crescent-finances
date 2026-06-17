// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildTransactions, assignOccurrences, type BuildSettings } from '../../src/lib/import/transactions';

const settings: BuildSettings = {
  mapping: { date: 'Date', debit: 'Debit', credit: 'Credit', label: 'Libelle' },
  dateFormat: 'dd/MM/yyyy',
  numberFormat: { decimal: ',', thousands: '.' },
  accountId: 'acc-1',
  source: 'sample.csv',
  importedAt: '2026-01-31T00:00:00.000Z'
};

const records = [
  { Date: '03/01/2026', Libelle: 'VIREMENT SALAIRE', Debit: '', Credit: '2450,00' },
  { Date: '06/01/2026', Libelle: 'SUPERMARCHE LE PANIER', Debit: '64,30', Credit: '' },
  { Date: '06/01/2026', Libelle: 'SUPERMARCHE LE PANIER', Debit: '64,30', Credit: '' }, // legit same-day dup
  { Date: 'bad', Libelle: 'BROKEN ROW', Debit: '10,00', Credit: '' }, // invalid date
  { Date: '08/01/2026', Libelle: 'NO AMOUNT', Debit: '', Credit: '' } // invalid amount
];

describe('assignOccurrences', () => {
  it('numbers identical rows 0,1,… and resets per distinct key', () => {
    const drafts = [
      { date: '2026-01-06', amount: -6430, label: 'x', normalizedLabel: 'x', accountId: 'a' },
      { date: '2026-01-06', amount: -6430, label: 'x', normalizedLabel: 'x', accountId: 'a' },
      { date: '2026-01-07', amount: -100, label: 'y', normalizedLabel: 'y', accountId: 'a' }
    ];
    expect(assignOccurrences(drafts)).toEqual([0, 1, 0]);
  });
});

describe('buildTransactions', () => {
  it('builds valid rows and reports errors for the rest', async () => {
    const { transactions, errors } = await buildTransactions(records, settings);
    expect(transactions).toHaveLength(3);
    expect(errors).toEqual([
      { index: 3, reason: 'date' },
      { index: 4, reason: 'amount' }
    ]);
    expect(transactions[0]).toMatchObject({
      date: '2026-01-03',
      amount: 245000,
      label: 'VIREMENT SALAIRE',
      accountId: 'acc-1',
      categoryId: null,
      source: 'sample.csv'
    });
  });

  it('keeps legit same-day duplicates as distinct fingerprints', async () => {
    const { transactions } = await buildTransactions(records, settings);
    const groceries = transactions.filter((t) => t.amount === -6430);
    expect(groceries).toHaveLength(2);
    expect(groceries[0].fingerprint).not.toBe(groceries[1].fingerprint);
  });

  it('is deterministic: re-import yields the same fingerprints (idempotent)', async () => {
    const a = await buildTransactions(records, settings);
    const b = await buildTransactions(records, settings);
    expect(a.transactions.map((t) => t.fingerprint)).toEqual(b.transactions.map((t) => t.fingerprint));
    // ids are random, fingerprints are stable.
    expect(a.transactions[0].id).not.toBe(b.transactions[0].id);
  });
});

describe('buildTransactions — category & entity columns', () => {
  const boursoSettings: BuildSettings = {
    mapping: {
      date: 'dateOp',
      amount: 'amount',
      label: 'label',
      entity: 'suggestedLabel',
      category: 'category'
    },
    dateFormat: 'yyyy-MM-dd',
    numberFormat: { decimal: ',', thousands: '' },
    accountId: 'acc-bourso',
    source: 'bourso.csv',
    importedAt: '2026-05-18T00:00:00.000Z',
    // Accent-insensitive name → app categoryId.
    categoryByName: { sante: 'cat-health' }
  };

  const boursoRecords = [
    {
      dateOp: '2026-05-18',
      label: 'CARTE 15/05/26 STEAM PURCHASE CB*5767',
      suggestedLabel: 'Steam',
      category: 'Santé',
      amount: '-7,49'
    }
  ];

  it('seeds categoryId from the bank category column (accent-insensitive)', async () => {
    const { transactions } = await buildTransactions(boursoRecords, boursoSettings);
    expect(transactions[0]).toMatchObject({
      amount: -749,
      entity: 'Steam',
      categoryId: 'cat-health'
    });
  });

  it('leaves categoryId null when the bank category has no app match', async () => {
    const { transactions } = await buildTransactions(boursoRecords, {
      ...boursoSettings,
      categoryByName: {}
    });
    expect(transactions[0].categoryId).toBeNull();
  });

  it('derives entity from labelCleanup when no clean-name column is mapped', async () => {
    const { transactions } = await buildTransactions(boursoRecords, {
      ...boursoSettings,
      mapping: { date: 'dateOp', amount: 'amount', label: 'label' },
      labelCleanup: [
        { pattern: '^CARTE\\s+\\d{2}/\\d{2}/\\d{2}\\s+', replacement: '' },
        { pattern: '\\s*CB\\*\\d+\\s*$', replacement: '' }
      ]
    });
    expect(transactions[0].entity).toBe('STEAM PURCHASE');
  });
});
