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
    account: z.string().optional()
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
 * A brand-new, empty configuration. Ships with ZERO predefined sections,
 * categories, or accounts — the user creates everything.
 */
export function emptyConfig(now: string = new Date().toISOString()): AppConfig {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { name: 'My configuration', createdAt: now, currency: 'EUR', locale: 'en-US' },
    accounts: [],
    assetPools: [],
    categories: [],
    tags: [],
    rules: [],
    sectionGroups: [],
    sections: [],
    importProfiles: [],
    settings: { anomaly: { baselineMonths: 6, thresholdPct: 40, minAbsolute: 5000, madK: 3 } }
  };
}
