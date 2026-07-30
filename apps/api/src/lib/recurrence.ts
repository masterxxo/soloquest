// Pure date/recurrence helpers — no DB access, so they stay easy to reason about
// and unit-test. Timezone handling lives entirely here.

import { DEFAULT_TIMEZONE, MS_PER_DAY } from './constants';

/**
 * Return the user's *current calendar date*, represented as a Date pinned to UTC
 * midnight of that day. e.g. a user in Europe/Warsaw at 2026-06-29 01:00 local
 * (= 2026-06-28 23:00 UTC) gets back 2026-06-29T00:00:00.000Z.
 *
 * We normalise to UTC midnight so downstream reads use getUTC* and never depend on
 * the *server's* timezone. Falls back to UTC if the timezone string is invalid.
 */
export function getUserDate(now: Date, timezone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    // Invalid IANA timezone → fall back to the default zone.
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  }

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

/** Format a date as 'YYYY-MM-DD' using its UTC components (pairs with getUserDate). */
export function toDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a 'YYYY-MM-DD' string into a Date at UTC midnight (pairs with toDateString). */
export function fromDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  // value is a validated 'YYYY-MM-DD' string, so all three parts are present.
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/** Truncate any timestamp to UTC midnight of its calendar day. */
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Was this recurring quest required on the given day?
 *
 * `date` must already be the user's local calendar day at UTC midnight (use
 * getUserDate). The caller owns timezone conversion; this function is pure.
 *
 *   daily        → always.
 *   every_x_days → whole days since createdAt is a multiple of recurrenceValue.
 *   weekdays     → the day's weekday bit is set in the bitmask (bit 0 = Mon … 6 = Sun).
 */
export function wasRequiredOn(
  quest: { recurrenceType: string; recurrenceValue: number | null; createdAt: Date },
  date: Date,
): boolean {
  switch (quest.recurrenceType) {
    case 'daily':
      return true;

    case 'every_x_days': {
      if (!quest.recurrenceValue || quest.recurrenceValue < 1) return false;
      const start = toUtcMidnight(quest.createdAt);
      const diffDays = Math.round((date.getTime() - start.getTime()) / MS_PER_DAY);
      if (diffDays < 0) return false; // before the quest existed
      return diffDays % quest.recurrenceValue === 0;
    }

    case 'weekdays': {
      if (quest.recurrenceValue == null) return false;
      // getUTCDay: 0=Sun … 6=Sat. Remap so 0=Mon … 6=Sun to match the bitmask.
      const bit = (date.getUTCDay() + 6) % 7;
      return (quest.recurrenceValue & (1 << bit)) !== 0;
    }

    default:
      return false;
  }
}

/**
 * Can this recurring quest be completed for `completedDate`? Guards against XP/streak
 * farming: no future days, and nothing before the quest existed.
 *
 * All three args are local calendar dates in the user's timezone, formatted 'YYYY-MM-DD'.
 * Zero-padded date strings compare lexicographically == chronologically, so this is fully
 * timezone-agnostic: the caller owns the timezone by deriving every date via getUserDate,
 * keeping `today` and `createdDate` in a single frame of reference (no UTC/local mixing).
 */
export function isCompletableDate(
  completedDate: string,
  today: string,
  createdDate: string,
): boolean {
  return completedDate >= createdDate && completedDate <= today;
}

/**
 * Is `completedDate` recent enough to backfill — no older than `maxDaysBack` days before
 * `today` (and not in the future)? Both are the user's local calendar day, 'YYYY-MM-DD'.
 * The earliest allowed day is computed by date arithmetic (not string math), then compared
 * lexicographically — which equals chronological order for zero-padded dates. Pairs with
 * isCompletableDate: that one guards the quest's own range, this one the backfill window.
 */
export function isWithinBackfillWindow(
  completedDate: string,
  today: string,
  maxDaysBack: number,
): boolean {
  const earliest = toDateString(new Date(fromDateString(today).getTime() - maxDaysBack * MS_PER_DAY));
  return completedDate >= earliest && completedDate <= today;
}

/** A recurring quest's streak counters, recomputed from its completion history. */
export interface RecalculatedStreak {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastCompletedDate: string | null;
}

/**
 * Recompute a recurring quest's streak from scratch — from the full set of completion
 * dates plus the same `wasRequiredOn` predicate the cron and heatmap use. This is the
 * single streak definition: the /complete path recalculates rather than incrementing, so
 * backfilling a missed day in the *middle* of a run correctly re-joins the two halves
 * (an incremental update, which only looks at the previous required day, cannot).
 *
 * Walks every required day from `questStart` to `today` (both the user's local calendar
 * day at UTC midnight — step by MS_PER_DAY, never tripping over DST, exactly as
 * buildRecurringCalendar does):
 *   current → the run of consecutive completed required days ending at the most recent
 *             required day. `today`, if required but not yet completed, is "in progress":
 *             it neither extends nor breaks the streak, mirroring the cron which judges
 *             only closed days. So a missed *closed* day is the only thing that zeroes it.
 *   longest → the longest such run anywhere in the history window.
 *   total   → number of completions. lastCompletedDate → the latest completed day.
 */
export function recalculateStreak(
  quest: { recurrenceType: string; recurrenceValue: number | null; createdAt: Date },
  completedDates: ReadonlySet<string>,
  questStart: Date,
  today: Date,
): RecalculatedStreak {
  const todayTime = today.getTime();
  let longest = 0;
  let run = 0;
  for (let t = questStart.getTime(); t <= todayTime; t += MS_PER_DAY) {
    const day = new Date(t);
    if (!wasRequiredOn(quest, day)) continue;
    const done = completedDates.has(toDateString(day));
    // Today is still running: a not-yet-done today is neutral (skip), never a break.
    if (t === todayTime && !done) continue;
    if (done) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  let lastCompletedDate: string | null = null;
  for (const ds of completedDates) {
    if (lastCompletedDate === null || ds > lastCompletedDate) lastCompletedDate = ds;
  }

  return {
    currentStreak: run,
    longestStreak: longest,
    totalCompletions: completedDates.size,
    lastCompletedDate,
  };
}

/** Status of a single day in a recurring quest's completion calendar (heatmap). */
export type RecurringCalendarStatus = 'done' | 'missed' | 'not_scheduled';

/** One calendar day: a 'YYYY-MM-DD' date plus its completion status. */
export interface RecurringCalendarDay {
  date: string;
  status: RecurringCalendarStatus;
}

/**
 * Start of the heatmap window: max(quest start day, today − weeks·7 + 1).
 * Both dates are UTC midnight of the user's local day (see getUserDate).
 */
export function calendarWindowStart(today: Date, questStart: Date, weeks: number): Date {
  const earliest = new Date(today.getTime() - (weeks * 7 - 1) * MS_PER_DAY);
  return questStart.getTime() > earliest.getTime() ? questStart : earliest;
}

/**
 * Builds the day-by-day status calendar, from windowStart to today inclusive (no
 * future days). All dates are UTC midnight of the user's local day, so adding
 * MS_PER_DAY never trips over DST. The status rule is the single source of truth
 * shared with the cron via wasRequiredOn:
 *   done          → the date is in completedDates.
 *   missed        → a required day (wasRequiredOn) that is *closed* (before today) and uncompleted.
 *   not_scheduled → a non-required day, OR today (still in progress) with no completion.
 *
 * "missed" never applies to today — the day is still running, so a not-yet-completed
 * quest stays neutral until the day closes. This matches the cron, which only judges
 * yesterday (a fully closed day), never today.
 */
export function buildRecurringCalendar(
  quest: { recurrenceType: string; recurrenceValue: number | null; createdAt: Date },
  windowStart: Date,
  today: Date,
  completedDates: Set<string>,
): RecurringCalendarDay[] {
  const days: RecurringCalendarDay[] = [];
  for (let t = windowStart.getTime(); t <= today.getTime(); t += MS_PER_DAY) {
    const date = new Date(t);
    const ds = toDateString(date);
    let status: RecurringCalendarStatus;
    if (completedDates.has(ds)) status = 'done';
    else if (date.getTime() < today.getTime() && wasRequiredOn(quest, date)) status = 'missed';
    else status = 'not_scheduled';
    days.push({ date: ds, status });
  }
  return days;
}

/**
 * A fixed-width recent-history strip for the ritual list's "pip strip": exactly `days`
 * calendar days, oldest → today, each in the user's timezone (both `today` and `questStart`
 * are UTC midnight of the user's local day — see getUserDate). The status of each day uses
 * the *same* rule as the heatmap: it delegates to buildRecurringCalendar unchanged, so the
 * strip and the heatmap can never drift.
 *
 * The window is [today − (days − 1), today]. Days before the ritual existed are left-padded
 * as not_scheduled (a day before creation was never scheduled), because buildRecurringCalendar
 * only runs from the quest's start onward — it has no notion of "before I existed", and for a
 * daily/weekdays rule wasRequiredOn would otherwise mark those pre-creation days as missed.
 */
export function buildRecentHistory(
  quest: { recurrenceType: string; recurrenceValue: number | null; createdAt: Date },
  today: Date,
  days: number,
  questStart: Date,
  completedDates: Set<string>,
): RecurringCalendarDay[] {
  const windowStart = new Date(today.getTime() - (days - 1) * MS_PER_DAY);
  // Clamp the "real" (schedule-aware) portion to the day the ritual started.
  const effectiveStart =
    windowStart.getTime() > questStart.getTime() ? windowStart : questStart;

  const preCreation: RecurringCalendarDay[] = [];
  for (let t = windowStart.getTime(); t < effectiveStart.getTime(); t += MS_PER_DAY) {
    preCreation.push({ date: toDateString(new Date(t)), status: 'not_scheduled' });
  }

  return preCreation.concat(buildRecurringCalendar(quest, effectiveStart, today, completedDates));
}
