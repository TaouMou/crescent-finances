import { describe, it, expect } from 'vitest';
import { nextOccurrence } from '../../src/lib/sections/schedule';
import type { Schedule } from '../../src/lib/types';

const interval = (everyDays: number, anchor: string): Schedule => ({
  kind: 'interval',
  interval: { everyDays, anchor }
});
const anniversary = (
  month: number,
  day: number,
  calendar: 'gregorian' | 'hijri' | 'custom' = 'gregorian'
): Schedule => ({ kind: 'anniversary', anniversary: { calendar, month, day } });

describe('nextOccurrence — interval', () => {
  it('returns the anchor when from is before it', () => {
    expect(nextOccurrence(interval(30, '2026-06-01'), '2026-05-20')).toBe('2026-06-01');
  });

  it('returns the anchor itself when from equals it', () => {
    expect(nextOccurrence(interval(30, '2026-06-01'), '2026-06-01')).toBe('2026-06-01');
  });

  it('steps forward by whole periods past the anchor', () => {
    // anchor + 30 = 07-01, + 60 = 07-31
    expect(nextOccurrence(interval(30, '2026-06-01'), '2026-06-15')).toBe('2026-07-01');
    expect(nextOccurrence(interval(30, '2026-06-01'), '2026-07-01')).toBe('2026-07-01');
    expect(nextOccurrence(interval(30, '2026-06-01'), '2026-07-02')).toBe('2026-07-31');
  });

  it('returns null for a non-positive interval or bad anchor', () => {
    expect(nextOccurrence(interval(0, '2026-06-01'), '2026-06-15')).toBeNull();
    expect(nextOccurrence(interval(30, 'nope'), '2026-06-15')).toBeNull();
  });
});

describe('nextOccurrence — anniversary', () => {
  it('returns this year when the date is still ahead', () => {
    expect(nextOccurrence(anniversary(12, 25), '2026-06-15')).toBe('2026-12-25');
  });

  it('rolls to next year when the date has passed', () => {
    expect(nextOccurrence(anniversary(1, 1), '2026-06-15')).toBe('2027-01-01');
  });

  it('returns today when it is the anniversary', () => {
    expect(nextOccurrence(anniversary(6, 15), '2026-06-15')).toBe('2026-06-15');
  });

  it('does not compute non-gregorian calendars', () => {
    expect(nextOccurrence(anniversary(1, 1, 'hijri'), '2026-06-15')).toBeNull();
  });

  it('returns null for out-of-range month/day', () => {
    expect(nextOccurrence(anniversary(13, 1), '2026-06-15')).toBeNull();
  });
});
