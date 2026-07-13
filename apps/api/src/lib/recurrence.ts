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
 * The most recent day *before* `date` on which this quest was required, or null when
 * there isn't one. Used by the streak logic: a completion continues the streak only
 * when the last completion landed on exactly this day.
 *
 *   daily        → the day before.
 *   every_x_days → recurrenceValue days earlier (the fixed cadence's prior tick).
 *   weekdays     → the nearest earlier day (within 7) whose weekday bit is set.
 */
export function previousRequiredDate(
  quest: { recurrenceType: string; recurrenceValue: number | null; createdAt: Date },
  date: Date,
): Date | null {
  switch (quest.recurrenceType) {
    case 'daily':
      return new Date(date.getTime() - MS_PER_DAY);

    case 'every_x_days': {
      if (!quest.recurrenceValue || quest.recurrenceValue < 1) return null;
      return new Date(date.getTime() - quest.recurrenceValue * MS_PER_DAY);
    }

    case 'weekdays': {
      if (!quest.recurrenceValue) return null;
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(date.getTime() - i * MS_PER_DAY);
        const bit = (candidate.getUTCDay() + 6) % 7;
        if ((quest.recurrenceValue & (1 << bit)) !== 0) return candidate;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Can this ritual be completed for `completedDate`? Guards against XP/streak farming:
 * no future days, and nothing before the ritual existed.
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

/** Status of a single day in a ritual's completion calendar (heatmap). */
export type RitualCalendarStatus = 'done' | 'missed' | 'not_scheduled';

/** One calendar day: a 'YYYY-MM-DD' date plus its completion status. */
export interface RitualCalendarDay {
  date: string;
  status: RitualCalendarStatus;
}

/**
 * Start of the heatmap window: max(ritual start day, today − weeks·7 + 1).
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
 * ritual stays neutral until the day closes. This matches the cron, which only judges
 * yesterday (a fully closed day), never today.
 */
export function buildRitualCalendar(
  quest: { recurrenceType: string; recurrenceValue: number | null; createdAt: Date },
  windowStart: Date,
  today: Date,
  completedDates: Set<string>,
): RitualCalendarDay[] {
  const days: RitualCalendarDay[] = [];
  for (let t = windowStart.getTime(); t <= today.getTime(); t += MS_PER_DAY) {
    const date = new Date(t);
    const ds = toDateString(date);
    let status: RitualCalendarStatus;
    if (completedDates.has(ds)) status = 'done';
    else if (date.getTime() < today.getTime() && wasRequiredOn(quest, date)) status = 'missed';
    else status = 'not_scheduled';
    days.push({ date: ds, status });
  }
  return days;
}
