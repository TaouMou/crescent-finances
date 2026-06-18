/**
 * Currency + number formatting. Amounts are stored as integer minor units
 * (e.g. cents) to avoid float drift; formatters convert to major units.
 */

export interface MoneyFormatOptions {
  currency?: string;
  locale?: string;
  /** Show a leading +/- sign even for positive numbers. */
  signed?: boolean;
  /** Drop the decimals (round to whole units) for a cleaner, less busy display. */
  whole?: boolean;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string, whole: boolean): Intl.NumberFormat {
  const key = `${locale}|${currency}|${whole}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      ...(whole ? { maximumFractionDigits: 0 } : {})
    });
    formatterCache.set(key, f);
  }
  return f;
}

/** Format integer minor units (cents) as a currency string. */
export function formatMoney(minorUnits: number, opts: MoneyFormatOptions = {}): string {
  const { currency = 'EUR', locale = 'en-US', signed = false, whole = false } = opts;
  const major = minorUnits / 100;
  const base = getFormatter(locale, currency, whole).format(Math.abs(major));
  if (minorUnits < 0) return `-${base}`;
  if (signed && minorUnits > 0) return `+${base}`;
  return base;
}

/** Compact form for axis labels and dense cards, e.g. "€1.2k". */
export function formatMoneyCompact(minorUnits: number, opts: MoneyFormatOptions = {}): string {
  const { currency = 'EUR', locale = 'en-US' } = opts;
  const major = minorUnits / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(major);
}

export function formatPercent(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(value / 100);
}

/**
 * Parse a user-typed money string into integer minor units (cents), or `null`
 * when empty/invalid. Tolerant of how people actually type amounts:
 *   "1500" → 150000 · "1500,50" → 150050 · "1 500,50" → 150050 ·
 *   "1500.50" → 150050 · "1,500.50" → 150050 · "-50" → -5000
 * Negatives are allowed (e.g. a credit-card debt anchor).
 */
export function parseMoneyInput(raw: string): number | null {
  let s = raw.replace(/\s/g, '');
  if (s === '') return null;
  // Both separators present → comma is a thousands separator; drop it.
  // Otherwise treat a lone comma as the decimal separator.
  s = s.includes(',') && s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

