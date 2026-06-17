/**
 * Zod schemas for the shareable configuration. The config is deliberately
 * financial-data-FREE (no transactions, no balances) so it can be exported as a
 * plain, hand-editable template. Parsing is strict where it matters and
 * forgiving where hand-editing is expected (optional fields default sensibly).
 *
 * Keep these in sync with the TS interfaces in src/lib/types.ts.
 */

import { z } from 'zod';
import type { AppConfig } from '$lib/types';

export const SCHEMA_VERSION = 1;

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'expected a hex color like #14776B');

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['bank', 'cash', 'card', 'savings'])
});

export const assetPoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  accountIds: z.array(z.string()).default([])
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: hexColor,
  parentId: z.string().nullable().default(null)
});

export const tagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: hexColor
});

export const ruleSchema = z.object({
  id: z.string().min(1),
  priority: z.number().int(),
  enabled: z.boolean().default(true),
  match: z.object({
    field: z.enum(['label', 'entity']),
    type: z.enum(['keyword', 'regex']),
    value: z.string().min(1),
    caseSensitive: z.boolean().default(false)
  }),
  setCategoryId: z.string().optional(),
  setEntity: z.string().optional(),
  addTagIds: z.array(z.string()).optional()
});

const sourceRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('income') }),
  z.object({ kind: z.literal('surplus') }),
  z.object({ kind: z.literal('assetPool'), id: z.string().min(1) }),
  z.object({ kind: z.literal('section'), id: z.string().min(1) })
]);

const transactionFilterSchema = z.object({
  categoryIds: z.array(z.string()).optional(),
  accountIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  entity: z.string().optional(),
  minAmount: z.number().int().optional(),
  maxAmount: z.number().int().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  query: z.string().optional()
});

const sectionCalcSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('percentage'), of: sourceRefSchema, percent: z.number() }),
  z.object({ type: z.literal('fixed'), amount: z.number().int() }),
  z.object({ type: z.literal('remainder') }),
  z.object({ type: z.literal('filterSum'), filter: transactionFilterSchema, planned: z.number().int().optional() }),
  z.object({ type: z.literal('accountBalance'), assetPoolId: z.string().min(1) }),
  z.object({
    type: z.literal('target'),
    targetAmount: z.number().int(),
    targetDate: z.string().optional(),
    startDate: z.string().optional(),
    assetPoolId: z.string().optional()
  })
]);

const scheduleSchema = z.object({
  kind: z.enum(['interval', 'anniversary']),
  interval: z.object({ everyDays: z.number().int().positive(), anchor: z.string() }).optional(),
  anniversary: z
    .object({
      calendar: z.enum(['gregorian', 'hijri', 'custom']),
      month: z.number().int().min(1).max(13),
      day: z.number().int().min(1).max(31)
    })
    .optional()
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: hexColor,
  groupId: z.string().nullable().default(null),
  order: z.number().int().default(0),
  calc: sectionCalcSchema,
  schedule: scheduleSchema.optional()
});

export const sectionGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().default(0),
  kind: z.enum(['distribution', 'plain']),
  sectionIds: z.array(z.string()).default([])
});

export const importProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  delimiter: z.string().min(1),
  encoding: z.enum(['utf-8', 'latin1']),
  hasHeader: z.boolean(),
  dateFormat: z.string().min(1),
  decimal: z.string(),
  thousands: z.string(),
  mapping: z.object({
    date: z.string(),
    amount: z.string().optional(),
    debit: z.string().optional(),
    credit: z.string().optional(),
    label: z.string(),
    account: z.string().optional(),
    category: z.string().optional(),
    entity: z.string().optional()
  }),
  accountId: z.string().nullable().default(null)
});

export const anomalySettingsSchema = z.object({
  baselineMonths: z.number().int().positive().default(6),
  thresholdPct: z.number().default(40),
  minAbsolute: z.number().int().default(5000),
  madK: z.number().default(3)
});

export const configSchema = z.object({
  schemaVersion: z.number().int().positive(),
  meta: z.object({
    name: z.string().default('My configuration'),
    createdAt: z.string(),
    currency: z.string().default('EUR'),
    locale: z.string().default('en-US')
  }),
  accounts: z.array(accountSchema).default([]),
  assetPools: z.array(assetPoolSchema).default([]),
  categories: z.array(categorySchema).default([]),
  tags: z.array(tagSchema).default([]),
  rules: z.array(ruleSchema).default([]),
  sectionGroups: z.array(sectionGroupSchema).default([]),
  sections: z.array(sectionSchema).default([]),
  importProfiles: z.array(importProfileSchema).default([]),
  settings: z
    .object({ anomaly: anomalySettingsSchema.default({}) })
    .default({ anomaly: {} })
});

export type ParsedConfig = z.infer<typeof configSchema>;

/** Parse + validate untrusted config JSON. Throws ZodError on invalid input. */
export function parseConfig(input: unknown): AppConfig {
  return configSchema.parse(input) as AppConfig;
}

/** Non-throwing variant. */
export function safeParseConfig(input: unknown) {
  return configSchema.safeParse(input);
}

/**
 * A handful of starter categories so a fresh vault is immediately usable and the
 * sample import has somewhere to land. Stable ids (no randomness) so the matching
 * starter rules can reference them and re-seeding is idempotent.
 */
export function starterCategories(): AppConfig['categories'] {
  return [
    { id: 'cat-income', name: 'Income', color: '#1A9E6F', parentId: null },
    { id: 'cat-groceries', name: 'Groceries', color: '#0DA882', parentId: null },
    { id: 'cat-rent', name: 'Rent', color: '#2B8AB5', parentId: null },
    { id: 'cat-transport', name: 'Transport', color: '#6B9E40', parentId: null },
    { id: 'cat-dining', name: 'Dining', color: '#D4843A', parentId: null },
    { id: 'cat-utilities', name: 'Utilities', color: '#6E7A82', parentId: null },
    { id: 'cat-health', name: 'Health', color: '#C0567E', parentId: null },
    { id: 'cat-shopping', name: 'Shopping', color: '#8A6FB0', parentId: null },
    { id: 'cat-savings', name: 'Savings', color: '#14776B', parentId: null }
  ];
}

/**
 * Keyword rules mapping the bundled sample.csv merchants onto the starter
 * categories, so imported sample rows auto-categorize. Stable ids for
 * idempotent re-seeding.
 */
export function starterRules(): AppConfig['rules'] {
  const kw = (value: string): { field: 'label'; type: 'keyword'; value: string; caseSensitive: boolean } => ({
    field: 'label',
    type: 'keyword',
    value,
    caseSensitive: false
  });
  return [
    { id: 'rule-salaire', priority: 10, enabled: true, match: kw('SALAIRE'), setCategoryId: 'cat-income' },
    { id: 'rule-remboursement', priority: 11, enabled: true, match: kw('REMBOURSEMENT'), setCategoryId: 'cat-income' },
    { id: 'rule-supermarche', priority: 20, enabled: true, match: kw('SUPERMARCHE'), setCategoryId: 'cat-groceries' },
    { id: 'rule-loyer', priority: 30, enabled: true, match: kw('LOYER'), setCategoryId: 'cat-rent' },
    { id: 'rule-station', priority: 40, enabled: true, match: kw('STATION'), setCategoryId: 'cat-transport' },
    { id: 'rule-transport', priority: 41, enabled: true, match: kw('ABONNEMENT TRANSPORT'), setCategoryId: 'cat-transport' },
    { id: 'rule-restaurant', priority: 50, enabled: true, match: kw('RESTAURANT'), setCategoryId: 'cat-dining' },
    { id: 'rule-cafe', priority: 51, enabled: true, match: kw('CAFE'), setCategoryId: 'cat-dining' },
    { id: 'rule-facture', priority: 60, enabled: true, match: kw('FACTURE'), setCategoryId: 'cat-utilities' },
    { id: 'rule-streaming', priority: 61, enabled: true, match: kw('STREAMING'), setCategoryId: 'cat-utilities' },
    { id: 'rule-pharmacie', priority: 70, enabled: true, match: kw('PHARMACIE'), setCategoryId: 'cat-health' },
    { id: 'rule-librairie', priority: 80, enabled: true, match: kw('LIBRAIRIE'), setCategoryId: 'cat-shopping' },
    { id: 'rule-epargne', priority: 90, enabled: true, match: kw('EPARGNE'), setCategoryId: 'cat-savings' }
  ];
}

/**
 * A brand-new configuration, seeded with a starter set of categories + rules so
 * the app is immediately usable (and the sample import auto-categorizes).
 */
export function emptyConfig(now: string = new Date().toISOString()): AppConfig {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { name: 'My configuration', createdAt: now, currency: 'EUR', locale: 'en-US' },
    accounts: [],
    assetPools: [],
    categories: starterCategories(),
    tags: [],
    rules: starterRules(),
    sectionGroups: [],
    sections: [],
    importProfiles: [],
    settings: { anomaly: { baselineMonths: 6, thresholdPct: 40, minAbsolute: 5000, madK: 3 } }
  };
}
