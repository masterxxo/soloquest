import { describe, it, expect } from 'vitest';
import {
  buildRecentHistory,
  getUserDate,
  isCompletableDate,
  isWithinBackfillWindow,
  toDateString,
} from './recurrence';

describe('isCompletableDate', () => {
  // All args are local calendar dates in the user's timezone ('YYYY-MM-DD').
  const createdDate = '2026-06-01';
  const today = '2026-07-03';

  it('accepts today', () => {
    expect(isCompletableDate('2026-07-03', today, createdDate)).toBe(true);
  });

  it('accepts a past date within the active range', () => {
    expect(isCompletableDate('2026-06-15', today, createdDate)).toBe(true);
  });

  it('accepts the creation day itself', () => {
    expect(isCompletableDate('2026-06-01', today, createdDate)).toBe(true);
  });

  it('rejects a future date', () => {
    expect(isCompletableDate('2026-07-04', today, createdDate)).toBe(false);
  });

  it('rejects a date before the quest existed', () => {
    expect(isCompletableDate('2026-05-31', today, createdDate)).toBe(false);
  });

  it('uses the user timezone for "today" (via getUserDate)', () => {
    // 2026-07-03 23:30 UTC is still 2026-07-03 19:30 in New York, so today = 2026-07-03.
    const nyToday = toDateString(getUserDate(new Date('2026-07-03T23:30:00Z'), 'America/New_York'));
    expect(isCompletableDate('2026-07-03', nyToday, createdDate)).toBe(true);
    expect(isCompletableDate('2026-07-04', nyToday, createdDate)).toBe(false);
  });

  it('allows completing today a quest created late last local evening in a negative offset tz', () => {
    // Regression: quest created 2026-07-02 23:30 America/New_York = 2026-07-03 03:30 UTC.
    // Anchoring createdDate in UTC (the old toUtcMidnight path) yielded 2026-07-03 and wrongly
    // rejected a same-local-day completion. Deriving it through getUserDate keeps it 2026-07-02.
    const tz = 'America/New_York';
    const createdAt = new Date('2026-07-03T03:30:00Z');
    const nyCreatedDate = toDateString(getUserDate(createdAt, tz));
    const nyToday = toDateString(getUserDate(new Date('2026-07-02T23:45:00Z'), tz));
    expect(nyCreatedDate).toBe('2026-07-02');
    expect(nyToday).toBe('2026-07-02');
    expect(isCompletableDate('2026-07-02', nyToday, nyCreatedDate)).toBe(true);
  });
});

describe('isWithinBackfillWindow', () => {
  const today = '2026-07-15';

  it('accepts today', () => {
    expect(isWithinBackfillWindow('2026-07-15', today, 7)).toBe(true);
  });

  it('accepts the oldest in-window day (exactly maxDaysBack ago)', () => {
    expect(isWithinBackfillWindow('2026-07-08', today, 7)).toBe(true);
  });

  it('rejects a day one past the window', () => {
    expect(isWithinBackfillWindow('2026-07-07', today, 7)).toBe(false);
  });

  it('rejects a future day', () => {
    expect(isWithinBackfillWindow('2026-07-16', today, 7)).toBe(false);
  });

  it('crosses a month boundary by date arithmetic, not string math', () => {
    expect(isWithinBackfillWindow('2026-06-28', '2026-07-03', 7)).toBe(true);
    expect(isWithinBackfillWindow('2026-06-25', '2026-07-03', 7)).toBe(false);
  });
});

describe('buildRecentHistory', () => {
  // A UTC-midnight day, exactly as getUserDate hands one back to the route.
  const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const DAYS = 7;
  // The 7-day window ending 2026-07-15 (oldest → today):
  //   07-09 Thu, 07-10 Fri, 07-11 Sat, 07-12 Sun, 07-13 Mon, 07-14 Tue, 07-15 Wed.
  const today = day('2026-07-15');
  const statusOn = (strip: { date: string; status: string }[], date: string) =>
    strip.find((d) => d.date === date)!.status;

  it('returns exactly DAYS entries, oldest → today, and no future day', () => {
    const quest = { recurrenceType: 'daily', recurrenceValue: null, createdAt: day('2026-01-01') };
    const strip = buildRecentHistory(quest, today, DAYS, day('2026-01-01'), new Set());

    expect(strip).toHaveLength(DAYS);
    expect(strip.map((d) => d.date)).toEqual([
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
    ]);
    expect(strip.at(-1)!.date).toBe(toDateString(today));
  });

  it('daily: every closed day is required — done vs missed, today still in progress', () => {
    const quest = { recurrenceType: 'daily', recurrenceValue: null, createdAt: day('2026-01-01') };
    // One completion mid-window (a backdated day shows as done), nothing today.
    const strip = buildRecentHistory(quest, today, DAYS, day('2026-01-01'), new Set(['2026-07-12']));

    expect(statusOn(strip, '2026-07-12')).toBe('done'); // completed → done
    expect(statusOn(strip, '2026-07-09')).toBe('missed'); // required, closed, uncompleted
    expect(statusOn(strip, '2026-07-14')).toBe('missed');
    // Today is required but not yet done → neutral (in progress), never missed.
    expect(statusOn(strip, '2026-07-15')).toBe('not_scheduled');
  });

  it('daily: a completed today reads as done', () => {
    const quest = { recurrenceType: 'daily', recurrenceValue: null, createdAt: day('2026-01-01') };
    const strip = buildRecentHistory(quest, today, DAYS, day('2026-01-01'), new Set(['2026-07-15']));
    expect(statusOn(strip, '2026-07-15')).toBe('done');
  });

  it('every_x_days: only days a multiple of the interval from the start are required', () => {
    // Interval 2 from 2026-07-09 → required on 07-09, 07-11, 07-13, 07-15.
    const start = day('2026-07-09');
    const quest = { recurrenceType: 'every_x_days', recurrenceValue: 2, createdAt: start };
    const strip = buildRecentHistory(quest, today, DAYS, start, new Set(['2026-07-11']));

    expect(statusOn(strip, '2026-07-11')).toBe('done');
    expect(statusOn(strip, '2026-07-09')).toBe('missed'); // required, closed, uncompleted
    expect(statusOn(strip, '2026-07-13')).toBe('missed');
    expect(statusOn(strip, '2026-07-10')).toBe('not_scheduled'); // off day
    expect(statusOn(strip, '2026-07-12')).toBe('not_scheduled');
    expect(statusOn(strip, '2026-07-15')).toBe('not_scheduled'); // required today, in progress
  });

  it('weekdays: honors the Mon-indexed bitmask (bit 0 = Mon … 6 = Sun)', () => {
    // Mon–Fri = bits 0..4 set = 0b0011111 = 31. Sat/Sun are off days.
    const quest = { recurrenceType: 'weekdays', recurrenceValue: 31, createdAt: day('2026-01-01') };
    const strip = buildRecentHistory(quest, today, DAYS, day('2026-01-01'), new Set());

    expect(statusOn(strip, '2026-07-11')).toBe('not_scheduled'); // Sat, off
    expect(statusOn(strip, '2026-07-12')).toBe('not_scheduled'); // Sun, off
    expect(statusOn(strip, '2026-07-09')).toBe('missed'); // Thu, required, closed
    expect(statusOn(strip, '2026-07-13')).toBe('missed'); // Mon, required, closed
    expect(statusOn(strip, '2026-07-15')).toBe('not_scheduled'); // Wed, required today, in progress
  });

  it('a ritual created mid-window: days before it existed are not_scheduled', () => {
    // Daily ritual that only started on 2026-07-13 — the earlier four days never existed.
    const start = day('2026-07-13');
    const quest = { recurrenceType: 'daily', recurrenceValue: null, createdAt: start };
    const strip = buildRecentHistory(quest, today, DAYS, start, new Set(['2026-07-14']));

    expect(strip).toHaveLength(DAYS);
    expect(statusOn(strip, '2026-07-09')).toBe('not_scheduled'); // before creation
    expect(statusOn(strip, '2026-07-12')).toBe('not_scheduled'); // before creation
    expect(statusOn(strip, '2026-07-13')).toBe('missed'); // required, closed, uncompleted
    expect(statusOn(strip, '2026-07-14')).toBe('done'); // completed
    expect(statusOn(strip, '2026-07-15')).toBe('not_scheduled'); // today, in progress
  });

  it('resolves "today" (and the window) in the user timezone, not UTC', () => {
    // 2026-07-16 02:30 UTC is still 2026-07-15 22:30 in New York — so the user's "today",
    // and thus the last pip, is 07-15, and the window ends there (not 07-16).
    const tz = 'America/New_York';
    const userToday = getUserDate(new Date('2026-07-16T02:30:00Z'), tz);
    const quest = { recurrenceType: 'daily', recurrenceValue: null, createdAt: day('2026-01-01') };
    const strip = buildRecentHistory(quest, userToday, DAYS, day('2026-01-01'), new Set());

    expect(strip.at(-1)!.date).toBe('2026-07-15');
    expect(strip[0]!.date).toBe('2026-07-09');
  });
});
