/**
 * Pure configuration defaults — the starter categories/rules and the empty-config
 * builder. Deliberately ZOD-FREE so boot-path modules (the config store, the vault
 * store) can seed a fresh vault without pulling the validation library (~15KB) onto
 * the critical path. The zod schemas + parsing live in ./schema and are loaded only
 * when validation actually runs (config import, backup restore, template parsing).
 *
 * Keep these in sync with the TS interfaces in src/lib/types.ts.
 */

import type { AppConfig } from '$lib/types';

export const SCHEMA_VERSION = 1;

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
