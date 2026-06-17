/**
 * Pure schedule helpers. A section's optional `schedule` (src/lib/types.ts)
 * describes when it recurs — a fixed interval from an anchor date, or a yearly
 * anniversary. This module computes the next occurrence so the UI can surface it
 * (e.g. "Rent · next 4 Jul"). No Svelte/DOM globals.
 *
 * Dates are ISO YYYY-MM-DD, compared in UTC to avoid timezone drift.
 */

import type { Schedule } from '$lib/types';

const DAY_MS = 86_400_000;

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseUTC(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/**
 * The next occurrence date (YYYY-MM-DD) on or after `from`, or `null` when it
 * can't be computed (missing/invalid fields, or a non-gregorian calendar whose
 * arithmetic we don't implement). `from` defaults to today (UTC).
 */
export function nextOccurrence(
  schedule: Schedule,
  from: string = new Date().toISOString().slice(0, 10)
): string | null {
  const fromMs = parseUTC(from);
  if (Number.isNaN(fromMs)) return null;

  if (schedule.kind === 'interval' && schedule.interval) {
    const { everyDays, anchor } = schedule.interval;
    const startMs = parseUTC(anchor);
    if (everyDays <= 0 || Number.isNaN(startMs)) return null;
    if (fromMs <= startMs) return isoOf(startMs);
    const periods = Math.ceil((fromMs - startMs) / (everyDays * DAY_MS));
    return isoOf(startMs + periods * everyDays * DAY_MS);
  }

  if (schedule.kind === 'anniversary' && schedule.anniversary) {
    const { calendar, month, day } = schedule.anniversary;
    // Only the gregorian calendar is computed; hijri/custom are stored but not
    // projected to a concrete date here.
    if (calendar !== 'gregorian') return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const year = new Date(fromMs).getUTCFullYear();
    const make = (y: number) => Date.UTC(y, month - 1, day);
    const occ = make(year);
    return isoOf(occ >= fromMs ? occ : make(year + 1));
  }

  return null;
}
