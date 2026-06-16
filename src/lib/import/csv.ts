/**
 * Framing helpers around the raw parsed grid: header detection and turning rows
 * into keyed records the mapping step can reference. The actual CSV tokenization
 * (PapaParse) happens in the worker; everything here is pure.
 */

import type { Delimiter, Encoding } from './detect';
import { parseAmountCents } from './parse';

export interface ParseResult {
  delimiter: Delimiter;
  encoding: Encoding;
  hasHeader: boolean;
  /** Column keys: header labels when hasHeader, else "Column 1", "Column 2", … */
  headers: string[];
  /** Data rows only (header row excluded when hasHeader). */
  rows: string[][];
  totalRows: number;
}

export function syntheticHeaders(columns: number): string[] {
  return Array.from({ length: columns }, (_, i) => `Column ${i + 1}`);
}

/**
 * Guess whether the first row is a header: a header has no cell that parses as a
 * number, and at least one non-empty cell. Cheap heuristic; the UI lets the user
 * override it.
 */
export function looksLikeHeader(firstRow: string[]): boolean {
  const nonEmpty = firstRow.some((c) => c.trim() !== '');
  if (!nonEmpty) return false;
  const anyNumeric = firstRow.some(
    (c) => parseAmountCents(c, { decimal: ',', thousands: '.' }) !== null
  );
  return !anyNumeric;
}

/** Map a data row to a record keyed by the resolved header names. */
export function rowToRecord(row: string[], headers: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((h, i) => {
    rec[h] = row[i] ?? '';
  });
  return rec;
}

export function rowsToRecords(rows: string[][], headers: string[]): Array<Record<string, string>> {
  return rows.map((r) => rowToRecord(r, headers));
}
