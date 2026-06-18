import { describe, it, expect } from 'vitest';
import { parseMoneyInput } from '../../src/lib/utils/currency';

describe('parseMoneyInput', () => {
  it('parses plain whole numbers', () => {
    expect(parseMoneyInput('1500')).toBe(150000);
  });

  it('parses comma decimals (French/Boursorama style)', () => {
    expect(parseMoneyInput('1500,50')).toBe(150050);
  });

  it('ignores spaces used as thousands separators', () => {
    expect(parseMoneyInput('1 500,50')).toBe(150050);
  });

  it('parses period decimals', () => {
    expect(parseMoneyInput('1500.50')).toBe(150050);
  });

  it('treats comma as thousands when a period decimal is present', () => {
    expect(parseMoneyInput('1,500.50')).toBe(150050);
  });

  it('rounds to the nearest cent', () => {
    expect(parseMoneyInput('10.005')).toBe(1001);
  });

  it('supports negative balances (debt anchors)', () => {
    expect(parseMoneyInput('-50')).toBe(-5000);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('   ')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
  });
});
