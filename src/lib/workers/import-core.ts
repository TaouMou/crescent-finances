/**
 * Import side of the worker: CSV tokenization (PapaParse, lazily imported so it
 * stays out of the main bundle) plus transaction building. No key access — these
 * operate purely on the supplied bytes/records.
 */

import { decodeBytes, detectDelimiter, detectEncoding, type Delimiter, type Encoding } from '$lib/import/detect';
import { looksLikeHeader, syntheticHeaders, type ParseResult } from '$lib/import/csv';
import { buildTransactions, type BuildResult, type BuildSettings } from '$lib/import/transactions';

export interface ParseOptions {
  delimiter?: Delimiter;
  encoding?: Encoding;
  hasHeader?: boolean;
}

export async function parseCsv(bytes: ArrayBuffer, opts: ParseOptions = {}): Promise<ParseResult> {
  const view = new Uint8Array(bytes);
  const encoding = opts.encoding ?? detectEncoding(view);
  const text = decodeBytes(view, encoding);
  const delimiter = opts.delimiter ?? detectDelimiter(text);

  const Papa = (await import('papaparse')).default;
  const parsed = Papa.parse<string[]>(text.trim(), {
    delimiter,
    skipEmptyLines: 'greedy'
  });
  const grid = (parsed.data as string[][]).filter((r) => r.length > 0);

  const columns = grid.reduce((max, r) => Math.max(max, r.length), 0);
  const firstRow = grid[0] ?? [];
  const hasHeader = opts.hasHeader ?? looksLikeHeader(firstRow);

  const headers = hasHeader
    ? firstRow.map((h, i) => (h.trim() === '' ? `Column ${i + 1}` : h.trim()))
    : syntheticHeaders(columns);
  const rows = hasHeader ? grid.slice(1) : grid;

  return { delimiter, encoding, hasHeader, headers, rows, totalRows: rows.length };
}

export function buildFromRecords(
  records: Array<Record<string, string>>,
  settings: BuildSettings
): Promise<BuildResult> {
  return buildTransactions(records, settings);
}
