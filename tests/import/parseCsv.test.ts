// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../src/lib/workers/import-core';
import { rowsToRecords } from '../../src/lib/import/csv';

function bytesOf(rel: string): ArrayBuffer {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('parseCsv on the shipped sample', () => {
  it('detects ; delimiter, header, and yields the data rows', async () => {
    const res = await parseCsv(bytesOf('../../public/sample.csv'));
    expect(res.delimiter).toBe(';');
    expect(res.encoding).toBe('utf-8');
    expect(res.hasHeader).toBe(true);
    expect(res.headers).toEqual(['Date', 'Libelle', 'Debit', 'Credit']);
    expect(res.totalRows).toBeGreaterThan(10);

    const records = rowsToRecords(res.rows, res.headers);
    expect(records[0]).toMatchObject({ Date: '03/12/2025', Libelle: 'VIREMENT SALAIRE', Credit: '2450,00' });
  });

  it('honors an explicit latin1 + delimiter override', async () => {
    // Build a tiny latin1 ; -delimited blob with an accented label.
    const latin1 = new Uint8Array([
      ...'date;label\n2026-01-03;Caf'.split('').map((c) => c.charCodeAt(0)),
      0xe9 // é
    ]);
    const res = await parseCsv(latin1.buffer, { encoding: 'latin1', delimiter: ';', hasHeader: true });
    expect(res.headers).toEqual(['date', 'label']);
    expect(res.rows[0]).toEqual(['2026-01-03', 'Café']);
  });
});
