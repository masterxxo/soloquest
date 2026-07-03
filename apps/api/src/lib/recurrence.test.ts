import { describe, it, expect } from 'vitest';
import { fromDateString, getUserDate, isCompletableDate } from './recurrence';

describe('isCompletableDate', () => {
  const createdAt = new Date('2026-06-01T10:00:00Z');
  const today = fromDateString('2026-07-03');

  it('accepts today', () => {
    expect(isCompletableDate(fromDateString('2026-07-03'), today, createdAt)).toBe(true);
  });

  it('accepts a past date within the active range', () => {
    expect(isCompletableDate(fromDateString('2026-06-15'), today, createdAt)).toBe(true);
  });

  it('accepts the creation day itself', () => {
    expect(isCompletableDate(fromDateString('2026-06-01'), today, createdAt)).toBe(true);
  });

  it('rejects a future date', () => {
    expect(isCompletableDate(fromDateString('2026-07-04'), today, createdAt)).toBe(false);
  });

  it('rejects a date before the ritual existed', () => {
    expect(isCompletableDate(fromDateString('2026-05-31'), today, createdAt)).toBe(false);
  });

  it('uses the user timezone for "today" (via getUserDate)', () => {
    // 2026-07-03 23:30 UTC is still 2026-07-03 19:30 in New York, so today = 2026-07-03.
    const nyToday = getUserDate(new Date('2026-07-03T23:30:00Z'), 'America/New_York');
    expect(isCompletableDate(fromDateString('2026-07-03'), nyToday, createdAt)).toBe(true);
    expect(isCompletableDate(fromDateString('2026-07-04'), nyToday, createdAt)).toBe(false);
  });
});
