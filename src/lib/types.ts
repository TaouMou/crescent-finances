/**
 * Core domain types. These describe runtime financial data (transactions) and
 * the shareable, financial-data-free configuration (accounts, categories,
 * sections, rules, …). Config-entity shapes are mirrored by zod schemas in
 * src/lib/config/schema.ts — keep the two in sync.
 *
 * Money is always integer minor units (cents), signed: negative = expense.
 */

export type AccountKind = 'bank' | 'cash' | 'card' | 'savings';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
}

export interface AssetPool {
  id: string;
  name: string;
  accountIds: string[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type RuleMatchField = 'label' | 'entity';
export type RuleMatchType = 'keyword' | 'regex';

export interface RuleMatch {
  field: RuleMatchField;
  type: RuleMatchType;
  value: string;
  caseSensitive: boolean;
}

export interface Rule {
  id: string;
  priority: number;
  enabled: boolean;
  match: RuleMatch;
  setCategoryId?: string;
  setEntity?: string;
  addTagIds?: string[];
}

/** Where a section draws its source amount from. */
export type SourceRef =
  | { kind: 'income' }
  | { kind: 'surplus' }
  | { kind: 'assetPool'; id: string }
  | { kind: 'section'; id: string };

export interface TransactionFilter {
  categoryIds?: string[];
  accountIds?: string[];
  tagIds?: string[];
  entity?: string;
  minAmount?: number;
  maxAmount?: number;
  /** Inclusive ISO date bounds. */
  fromDate?: string;
  toDate?: string;
  /** Free-text label search. */
  query?: string;
}

export type SectionCalc =
  | { type: 'percentage'; of: SourceRef; percent: number }
  | { type: 'fixed'; amount: number }
  | { type: 'remainder' }
  | { type: 'filterSum'; filter: TransactionFilter; planned?: number }
  | { type: 'accountBalance'; assetPoolId: string }
  | { type: 'target'; targetAmount: number; targetDate?: string; assetPoolId?: string };

export type CalendarKind = 'gregorian' | 'hijri' | 'custom';

export interface Schedule {
  kind: 'interval' | 'anniversary';
  interval?: { everyDays: number; anchor: string };
  anniversary?: { calendar: CalendarKind; month: number; day: number };
}

export interface Section {
  id: string;
  name: string;
  color: string;
  groupId: string | null;
  order: number;
  calc: SectionCalc;
  schedule?: Schedule;
}

export type SectionGroupKind = 'distribution' | 'plain';

export interface SectionGroup {
  id: string;
  name: string;
  order: number;
  kind: SectionGroupKind;
  sectionIds: string[];
}

export interface ImportProfileMapping {
  date: string;
  amount?: string;
  debit?: string;
  credit?: string;
  label: string;
  account?: string;
}

export interface ImportProfile {
  id: string;
  name: string;
  delimiter: string;
  encoding: 'utf-8' | 'latin1';
  hasHeader: boolean;
  dateFormat: string;
  decimal: string;
  thousands: string;
  mapping: ImportProfileMapping;
  accountId: string | null;
}

export interface AnomalySettings {
  baselineMonths: number;
  thresholdPct: number;
  minAbsolute: number;
  madK: number;
}

export interface ConfigMeta {
  name: string;
  createdAt: string;
  currency: string;
  locale: string;
}

export interface AppConfig {
  schemaVersion: number;
  meta: ConfigMeta;
  accounts: Account[];
  assetPools: AssetPool[];
  categories: Category[];
  tags: Tag[];
  rules: Rule[];
  sectionGroups: SectionGroup[];
  sections: Section[];
  importProfiles: ImportProfile[];
  settings: { anomaly: AnomalySettings };
}

/** A financial row. Stored encrypted at rest; this is the decrypted shape. */
export interface Transaction {
  id: string;
  /** sha256 of `date|amount|normalizedLabel|accountId` — used for dedup. */
  fingerprint: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Integer minor units, signed (<0 = expense). */
  amount: number;
  label: string;
  normalizedLabel: string;
  accountId: string | null;
  categoryId: string | null;
  entity: string | null;
  tagIds: string[];
  /** ISO timestamp of import. */
  importedAt: string;
  source: string;
}
