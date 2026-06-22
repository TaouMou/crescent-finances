import { describe, it, expect } from 'vitest';
import { buildStartingBalances, balancesEqual } from '../../src/lib/balances/form';

const TODAY = '2026-06-19';

describe('buildStartingBalances', () => {
  it('parses amounts (incl. comma decimals) into minor units', () => {
    const out = buildStartingBalances(
      { a: { amountStr: '1500,50', asOf: '2026-01-01' }, b: { amountStr: '200', asOf: '' } },
      TODAY
    );
    expect(out).toEqual({
      a: { amount: 150050, asOf: '2026-01-01' },
      b: { amount: 20000, asOf: TODAY }
    });
  });

  it('omits rows with empty or invalid amounts', () => {
    const out = buildStartingBalances(
      { a: { amountStr: '', asOf: '2026-01-01' }, b: { amountStr: 'abc', asOf: '' } },
      TODAY
    );
    expect(out).toEqual({});
  });

  it('defaults asOf to today when missing', () => {
    const out = buildStartingBalances({ a: { amountStr: '10', asOf: '' } }, TODAY);
    expect(out.a.asOf).toBe(TODAY);
  });

  it('produces a structured-cloneable plain object (guards the proxy regression)', () => {
    const out = buildStartingBalances({ a: { amountStr: '10', asOf: TODAY } }, TODAY);
    expect(() => structuredClone(out)).not.toThrow();
  });
});

describe('balancesEqual', () => {
  it('is true for equal maps', () => {
    expect(
      balancesEqual({ a: { amount: 100, asOf: 'x' } }, { a: { amount: 100, asOf: 'x' } })
    ).toBe(true);
  });

  it('is false when amount, date, key set, or size differ', () => {
    expect(balancesEqual({ a: { amount: 100, asOf: 'x' } }, { a: { amount: 200, asOf: 'x' } })).toBe(false);
    expect(balancesEqual({ a: { amount: 100, asOf: 'x' } }, { a: { amount: 100, asOf: 'y' } })).toBe(false);
    expect(balancesEqual({ a: { amount: 100, asOf: 'x' } }, { b: { amount: 100, asOf: 'x' } })).toBe(false);
    expect(balancesEqual({ a: { amount: 100, asOf: 'x' } }, {})).toBe(false);
  });
});
