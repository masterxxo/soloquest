import { describe, it, expect } from 'vitest';
import { getUserDate, isCompletableDate, toDateString } from './recurrence';

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

  it('rejects a date before the ritual existed', () => {
    expect(isCompletableDate('2026-05-31', today, createdDate)).toBe(false);
  });

  it('uses the user timezone for "today" (via getUserDate)', () => {
    // 2026-07-03 23:30 UTC is still 2026-07-03 19:30 in New York, so today = 2026-07-03.
    const nyToday = toDateString(getUserDate(new Date('2026-07-03T23:30:00Z'), 'America/New_York'));
    expect(isCompletableDate('2026-07-03', nyToday, createdDate)).toBe(true);
    expect(isCompletableDate('2026-07-04', nyToday, createdDate)).toBe(false);
  });

  it('allows completing today a ritual created late last local evening in a negative offset tz', () => {
    // Regression: ritual created 2026-07-02 23:30 America/New_York = 2026-07-03 03:30 UTC.
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
