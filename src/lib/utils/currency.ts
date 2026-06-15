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
