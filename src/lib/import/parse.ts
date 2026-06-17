/**
 * Pure parsers for the values inside CSV cells: localized numbers, dates in a
 * declared format, label normalization, and turning a row into a signed integer
 * minor-unit amount (from either one signed column or separate debit/credit).
 */

export interface NumberFormat {
  /** Decimal separator, e.g. ',' for European exports. */
  decimal: string;
  /** Thousands separator, e.g. '.' or ' ' (may be empty). */
  thousands: string;
}

/**
 * Parse a localized number string into integer minor units (cents). Returns
 * null for blank cells. Tolerates surrounding whitespace, a leading/trailing
 * sign, and currency symbols.
 */
export function parseAmountCents(raw: string, fmt: NumberFormat): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  let s = trimmed;
  let sign = 1;
  // Accounting-style negatives: (12,34)
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  // Strip everything that isn't a digit, sign, or a configured separator.
  s = s.replace(/[^\d+\-., ]/g, '');
  if (s.startsWith('-')) {
    sign *= -1;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (fmt.thousands) s = s.split(fmt.thousands).join('');
  // Normalize the decimal separator to '.'.
  if (fmt.decimal && fmt.decimal !== '.') s = s.split(fmt.decimal).join('.');
  // Any stray spaces (used as thousands) go too.
  s = s.replace(/\s/g, '');
  if (s === '' || s === '.') return null;

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) * sign;
}

type DatePart = 'dd' | 'MM' | 'yyyy' | 'yy' | 'HH' | 'mm' | 'ss';

/**
 * Parse a date string against a declared format into an ISO `YYYY-MM-DD` string.
 * Date tokens (`dd`, `MM`, `yyyy`, `yy`) carry the result; time tokens (`HH`,
 * `mm`, `ss`) are matched and discarded so timestamped exports like Revolut's
 * `yyyy-MM-dd HH:mm:ss` parse to their calendar date. Any single character
 * between tokens is treated as a literal separator. Returns null if it doesn't
 * match or the calendar date is invalid.
 */
export function parseDateISO(raw: string, format: string): string | null {
  const value = raw.trim();
  if (value === '') return null;

  // Longer tokens first so `yyyy` wins over `yy`.
  const tokenRe = /yyyy|yy|dd|MM|HH|mm|ss/g;
  const order: DatePart[] = ['yyyy', 'yy', 'dd', 'MM', 'HH', 'mm', 'ss'];
  const tokens = format.match(tokenRe) as DatePart[] | null;
  if (!tokens) return null;
  // Build a regex from the format: each token a digit group, separators literal.
  const groupFor: Record<DatePart, string> = {
    dd: '(\\d{1,2})',
    MM: '(\\d{1,2})',
    yyyy: '(\\d{4})',
    yy: '(\\d{2})',
    HH: '(\\d{1,2})',
    mm: '(\\d{1,2})',
    ss: '(\\d{1,2})'
  };
  let pattern = '^';
  for (let i = 0; i < format.length; ) {
    const tok = order.find((t) => format.startsWith(t, i));
    if (tok) {
      pattern += groupFor[tok];
      i += tok.length;
    } else {
      pattern += format[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }
  pattern += '$';

  const m = value.match(new RegExp(pattern));
  if (!m) return null;

  let day = 1;
  let month = 1;
  let year = 1970;
  tokens.forEach((tok, idx) => {
    const n = Number(m[idx + 1]);
    if (tok === 'dd') day = n;
    else if (tok === 'MM') month = n;
    else if (tok === 'yyyy') year = n;
    else if (tok === 'yy') year = 2000 + n;
    // HH/mm/ss are consumed by the regex but don't affect the calendar date.
  });

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Reject impossible calendar dates (e.g. 31/02).
  const d = new Date(`${iso}T00:00:00Z`);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
  return iso;
}

/** Normalize a label for fingerprinting/dedup: lowercase, collapse whitespace. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Normalize a name for accent- and case-insensitive matching (e.g. mapping a
 * bank's "Santé" category onto an app category). Strips diacritics so French
 * exports line up with plainly-spelled category names.
 */
export function normalizeMatchKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export interface LabelCleanupRule {
  /** Source regex (as a string, so it round-trips through the worker/config). */
  pattern: string;
  /** Replacement string (supports `$1` group references). */
  replacement: string;
}

/**
 * Derive a clean merchant name from a noisy bank label by applying an ordered
 * list of regex substitutions, then collapsing whitespace. Used for banks that
 * ship no clean-name column (e.g. stripping `CARTE 15/05/26 … CB*5767` down to
 * the merchant). Invalid patterns are skipped rather than thrown.
 */
export function applyLabelCleanup(label: string, rules: LabelCleanupRule[]): string {
  let out = label;
  for (const { pattern, replacement } of rules) {
    try {
      out = out.replace(new RegExp(pattern, 'gi'), replacement);
    } catch {
      // Ignore a malformed rule; leave the label as-is for that step.
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

export interface AmountMapping {
  amount?: string;
  debit?: string;
  credit?: string;
}

/**
 * Resolve a signed amount (cents) from a record using either a single signed
 * `amount` column or separate `debit`/`credit` columns. Debit is money out
 * (stored negative); credit is money in (positive). Returns null if neither
 * yields a value.
 */
export function resolveAmountCents(
  record: Record<string, string>,
  mapping: AmountMapping,
  fmt: NumberFormat
): number | null {
  if (mapping.amount) {
    return parseAmountCents(record[mapping.amount] ?? '', fmt);
  }
  const debit = mapping.debit ? parseAmountCents(record[mapping.debit] ?? '', fmt) : null;
  const credit = mapping.credit ? parseAmountCents(record[mapping.credit] ?? '', fmt) : null;
  if (debit === null && credit === null) return null;
  // Debit columns hold positive magnitudes for money leaving the account.
  return (credit ?? 0) - Math.abs(debit ?? 0);
}
