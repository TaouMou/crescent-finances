/**
 * Turn parsed CSV records into Transaction objects with stable fingerprints.
 *
 * Fingerprint = sha256(date | amount | normalizedLabel | accountId | occurrence).
 * The occurrence index is the row's position among otherwise-identical rows in
 * the same import. It keeps two legitimate same-day, same-amount, same-label
 * transactions distinct (so neither is silently dropped) while staying fully
 * deterministic — re-importing the same file yields the same fingerprints, so a
 * re-import is correctly recognized as all-duplicates.
 */

import { sha256Hex } from '$lib/crypto/crypto';
import type { ImportProfileMapping, Transaction } from '$lib/types';
import {
  applyLabelCleanup,
  normalizeLabel,
  normalizeMatchKey,
  parseDateISO,
  resolveAmountCents,
  type LabelCleanupRule,
  type NumberFormat
} from './parse';

export interface BuildSettings {
  mapping: ImportProfileMapping;
  dateFormat: string;
  numberFormat: NumberFormat;
  /** Default account when no per-row account column is mapped. */
  accountId: string | null;
  source: string;
  importedAt?: string;
  /**
   * Resolves a bank's category-column value to an app categoryId, keyed by
   * `normalizeMatchKey(name)`. Seeds `categoryId`; rules still override at commit.
   */
  categoryByName?: Record<string, string>;
  /**
   * Regex substitutions applied to the label to derive `entity` when no clean
   * `entity` column is mapped (e.g. stripping `CARTE …/CB*1234` boilerplate).
   */
  labelCleanup?: LabelCleanupRule[];
}

export interface RowError {
  index: number;
  reason: 'date' | 'amount';
}

export interface BuildResult {
  transactions: Transaction[];
  errors: RowError[];
}

interface Draft {
  date: string;
  amount: number;
  label: string;
  normalizedLabel: string;
  accountId: string | null;
  categoryId: string | null;
  entity: string | null;
}

/** Compute the per-(date,amount,label,account) occurrence index for each draft. */
export function assignOccurrences(
  drafts: Pick<Draft, 'date' | 'amount' | 'normalizedLabel' | 'accountId'>[]
): number[] {
  const seen = new Map<string, number>();
  return drafts.map((d) => {
    const key = `${d.date}|${d.amount}|${d.normalizedLabel}|${d.accountId ?? ''}`;
    const occ = seen.get(key) ?? 0;
    seen.set(key, occ + 1);
    return occ;
  });
}

export async function buildTransactions(
  records: Array<Record<string, string>>,
  settings: BuildSettings
): Promise<BuildResult> {
  const { mapping, dateFormat, numberFormat, accountId, source } = settings;
  const categoryByName = settings.categoryByName ?? {};
  const labelCleanup = settings.labelCleanup ?? [];
  const importedAt = settings.importedAt ?? new Date().toISOString();

  const drafts: Draft[] = [];
  const draftIndex: number[] = [];
  const errors: RowError[] = [];

  records.forEach((record, index) => {
    const date = parseDateISO(record[mapping.date] ?? '', dateFormat);
    if (!date) {
      errors.push({ index, reason: 'date' });
      return;
    }
    const amount = resolveAmountCents(record, mapping, numberFormat);
    if (amount === null) {
      errors.push({ index, reason: 'amount' });
      return;
    }
    const label = (record[mapping.label] ?? '').trim();
    const rowAccount = mapping.account ? (record[mapping.account] ?? '').trim() : '';

    // Seed the category from the bank's own column (rules override at commit).
    const categoryRaw = mapping.category ? (record[mapping.category] ?? '').trim() : '';
    const categoryId = categoryRaw ? (categoryByName[normalizeMatchKey(categoryRaw)] ?? null) : null;

    // Prefer an explicit clean-name column; else derive one via label cleanup.
    const entityRaw = mapping.entity ? (record[mapping.entity] ?? '').trim() : '';
    const entity =
      entityRaw || (labelCleanup.length ? applyLabelCleanup(label, labelCleanup) : '') || null;

    drafts.push({
      date,
      amount,
      label,
      normalizedLabel: normalizeLabel(label),
      accountId: rowAccount || accountId,
      categoryId,
      entity
    });
    draftIndex.push(index);
  });

  const occurrences = assignOccurrences(drafts);
  const transactions = await Promise.all(
    drafts.map(async (d, i) => {
      const fingerprint = await sha256Hex(
        `${d.date}|${d.amount}|${d.normalizedLabel}|${d.accountId ?? ''}|${occurrences[i]}`
      );
      const tx: Transaction = {
        id: globalThis.crypto.randomUUID(),
        fingerprint,
        date: d.date,
        amount: d.amount,
        label: d.label,
        normalizedLabel: d.normalizedLabel,
        accountId: d.accountId,
        categoryId: d.categoryId,
        entity: d.entity,
        tagIds: [],
        importedAt,
        source
      };
      return tx;
    })
  );

  return { transactions, errors };
}
