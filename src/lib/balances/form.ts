/**
 * Pure helpers for the Account-balances editor. Kept free of Svelte runes so the
 * editor can hold reactive `$state` drafts but hand the worker a plain,
 * structured-cloneable object — a `$state` proxy posted to the crypto worker
 * throws a DataCloneError (see ImportView's snapshot note), which is why
 * balances silently failed to save before.
 */

import type { StartingBalances } from '$lib/types';
import { parseMoneyInput } from '$lib/utils/currency';

export interface BalanceRowDraft {
  amountStr: string;
  asOf: string;
}

/**
 * Build a plain `StartingBalances` map from editable row drafts. Rows whose
 * amount is empty/invalid are omitted (cleared). A missing `asOf` defaults to
 * `today`. The result is a fresh plain object (no reactive proxy).
 */
export function buildStartingBalances(
  rows: Record<string, BalanceRowDraft>,
  today: string
): StartingBalances {
  const out: StartingBalances = {};
  for (const [key, row] of Object.entries(rows)) {
    const amount = parseMoneyInput(row.amountStr);
    if (amount === null) continue;
    out[key] = { amount, asOf: row.asOf || today };
  }
  return out;
}

/** Structural equality of two starting-balance maps (for dirty detection). */
export function balancesEqual(a: StartingBalances, b: StartingBalances): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const x = a[k];
    const y = b[k];
    if (!y || x.amount !== y.amount || x.asOf !== y.asOf) return false;
  }
  return true;
}
