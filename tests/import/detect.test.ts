import { describe, it, expect } from 'vitest';
import { detectDelimiter, detectEncoding, decodeBytes } from '../../src/lib/import/detect';

describe('detectEncoding', () => {
  it('detects valid utf-8', () => {
    const bytes = new TextEncoder().encode('Café résumé');
    expect(detectEncoding(bytes)).toBe('utf-8');
  });

  it('falls back to latin1 for non-utf-8 bytes', () => {
    // 0xE9 is "é" in latin1 but an invalid standalone utf-8 byte.
    const bytes = new Uint8Array([0x43, 0x61, 0x66, 0xe9]); // "Caf" + é
    expect(detectEncoding(bytes)).toBe('latin1');
    expect(decodeBytes(bytes, 'latin1')).toBe('Café');
  });

  it('strips a UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
    expect(decodeBytes(bytes, 'utf-8')).toBe('A');
  });
});

describe('detectDelimiter', () => {
  it('detects semicolons', () => {
    expect(detectDelimiter('Date;Libelle;Debit;Credit\n03/01/2026;X;1,00;')).toBe(';');
  });

  it('detects commas', () => {
    expect(detectDelimiter('date,amount,label\n2026-01-03,12.00,X')).toBe(',');
  });

  it('breaks ties toward semicolon', () => {
    expect(detectDelimiter('a;b,c')).toBe(';');
  });
});
