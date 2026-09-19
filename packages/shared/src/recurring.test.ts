import { describe, it, expect } from 'vitest';
import {
  completeRecurringQuestSchema,
  normalizeRecurrence,
  RecurrenceValidationError,
} from './recurring';

describe('normalizeRecurrence', () => {
  it('forces recurrenceValue to null for daily', () => {
    expect(normalizeRecurrence({ recurrenceType: 'daily', recurrenceValue: 5 })).toEqual({
      recurrenceType: 'daily',
      recurrenceValue: null,
    });
    expect(normalizeRecurrence({ recurrenceType: 'daily', recurrenceValue: null })).toEqual({
      recurrenceType: 'daily',
      recurrenceValue: null,
    });
  });

  it('keeps a positive interval for every_x_days', () => {
    expect(normalizeRecurrence({ recurrenceType: 'every_x_days', recurrenceValue: 3 })).toEqual({
      recurrenceType: 'every_x_days',
      recurrenceValue: 3,
    });
  });

  it('rejects every_x_days without a valid interval', () => {
    expect(() => normalizeRecurrence({ recurrenceType: 'every_x_days' })).toThrow(
      RecurrenceValidationError,
    );
    expect(() =>
      normalizeRecurrence({ recurrenceType: 'every_x_days', recurrenceValue: 0 }),
    ).toThrow(RecurrenceValidationError);
    expect(() =>
      normalizeRecurrence({ recurrenceType: 'every_x_days', recurrenceValue: null }),
    ).toThrow(RecurrenceValidationError);
  });

  it('keeps a valid weekday bitmask', () => {
    // 0b0000101 = Monday (bit 0) + Wednesday (bit 2).
    expect(
      normalizeRecurrence({ recurrenceType: 'weekdays', recurrenceValue: 0b0000101 }),
    ).toEqual({ recurrenceType: 'weekdays', recurrenceValue: 0b0000101 });
  });

  it('rejects a missing or out-of-range weekday bitmask', () => {
    expect(() =>
      normalizeRecurrence({ recurrenceType: 'weekdays', recurrenceValue: null }),
    ).toThrow(RecurrenceValidationError);
    expect(() =>
      normalizeRecurrence({ recurrenceType: 'weekdays', recurrenceValue: 0 }),
    ).toThrow(RecurrenceValidationError);
    // 0b10000000 = 128, beyond the 7 weekday bits (max 127).
    expect(() =>
      normalizeRecurrence({ recurrenceType: 'weekdays', recurrenceValue: 0b10000000 }),
    ).toThrow(RecurrenceValidationError);
  });
});

describe('completeRecurringQuestSchema', () => {
  it('accepts an empty body — a live complete leaves "today" to the server', () => {
    expect(completeRecurringQuestSchema.parse({})).toEqual({});
  });

  it('accepts an explicit calendar day (backfill) and rejects anything else', () => {
    expect(completeRecurringQuestSchema.parse({ completedDate: '2026-07-09' })).toEqual({
      completedDate: '2026-07-09',
    });
    expect(completeRecurringQuestSchema.safeParse({ completedDate: '2026-07-09T00:00:00Z' }).success).toBe(false);
  });
});
