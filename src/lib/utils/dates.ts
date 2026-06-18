/** Date helpers for timeframe selection and span description. */

/** YYYY-MM bucket string for the given date (defaults to today). */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM bucket string for the current month. */
export function currentMonth(): string {
  return monthKey();
}

/** First and last ISO dates (YYYY-MM-DD) of a YYYY-MM bucket. */
export function monthBounds(bucket: string): { from: string; to: string } {
  const [y, m] = bucket.split('-').map(Number);
  const from = `${bucket}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${bucket}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

/** Locale-aware label for a YYYY-MM bucket, e.g. "June 2026". */
export function formatMonthLabel(bucket: string, locale: string): string {
  const [y, m] = bucket.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** Calendar months + leftover days between two dates (to >= from). */
export function monthsDaysBetween(from: Date, to: Date): { months: number; days: number } {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    // Days in the month before `to` — borrow to make `days` non-negative.
    const daysInPrevMonth = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += daysInPrevMonth;
  }
  if (months < 0) return { months: 0, days: 0 };
  return { months, days };
}

/** Human phrase like "6 months, 14 days" (omits zero parts). */
export function formatSpan(months: number, days: number): string {
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (parts.length === 0) return '0 days';
  return parts.join(', ');
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local YYYY-MM-DD (for <input type="date"> values). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
