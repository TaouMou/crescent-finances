import { describe, it, expect } from 'vitest';
import {
  parseAmountCents,
  parseDateISO,
  normalizeLabel,
  resolveAmountCents
} from '../../src/lib/import/parse';

const eu = { decimal: ',', thousands: '.' };
const us = { decimal: '.', thousands: ',' };

describe('parseAmountCents', () => {
  it('parses comma decimals to integer cents', () => {
    expect(parseAmountCents('64,30', eu)).toBe(6430);
    expect(parseAmountCents('2450,00', eu)).toBe(245000);
  });

  it('handles European thousands separators', () => {
    expect(parseAmountCents('1.234,56', eu)).toBe(123456);
    expect(parseAmountCents('12 345,00', eu)).toBe(1234500);
  });

  it('parses US-style numbers', () => {
    expect(parseAmountCents('1,234.56', us)).toBe(123456);
  });

  it('handles signs and accounting parentheses', () => {
    expect(parseAmountCents('-50,00', eu)).toBe(-5000);
    expect(parseAmountCents('(12,34)', eu)).toBe(-1234);
  });

  it('returns null for blank cells', () => {
    expect(parseAmountCents('', eu)).toBeNull();
    expect(parseAmountCents('   ', eu)).toBeNull();
  });

  it('ignores currency symbols', () => {
    expect(parseAmountCents('€ 19,99', eu)).toBe(1999);
  });
});

describe('parseDateISO', () => {
  it('parses dd/MM/yyyy', () => {
    expect(parseDateISO('03/01/2026', 'dd/MM/yyyy')).toBe('2026-01-03');
  });

  it('parses dd-MM-yyyy and yyyy-MM-dd', () => {
    expect(parseDateISO('03-01-2026', 'dd-MM-yyyy')).toBe('2026-01-03');
    expect(parseDateISO('2026-01-03', 'yyyy-MM-dd')).toBe('2026-01-03');
  });

  it('parses two-digit years', () => {
    expect(parseDateISO('03/01/26', 'dd/MM/yy')).toBe('2026-01-03');
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateISO('31/02/2026', 'dd/MM/yyyy')).toBeNull();
    expect(parseDateISO('00/01/2026', 'dd/MM/yyyy')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseDateISO('not a date', 'dd/MM/yyyy')).toBeNull();
    expect(parseDateISO('', 'dd/MM/yyyy')).toBeNull();
  });
});

describe('normalizeLabel', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeLabel('  SUPERMARCHE   LE  PANIER ')).toBe('supermarche le panier');
  });
});

describe('resolveAmountCents', () => {
  it('reads a single signed amount column', () => {
    expect(resolveAmountCents({ Montant: '-50,00' }, { amount: 'Montant' }, eu)).toBe(-5000);
  });

  it('treats debit as money out (negative) and credit as money in', () => {
    expect(resolveAmountCents({ Debit: '820,50', Credit: '' }, { debit: 'Debit', credit: 'Credit' }, eu)).toBe(-82050);
    expect(resolveAmountCents({ Debit: '', Credit: '2450,00' }, { debit: 'Debit', credit: 'Credit' }, eu)).toBe(245000);
  });

  it('returns null when neither column has a value', () => {
    expect(resolveAmountCents({ Debit: '', Credit: '' }, { debit: 'Debit', credit: 'Credit' }, eu)).toBeNull();
  });
});
