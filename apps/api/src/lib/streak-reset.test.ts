import { describe, it, expect } from 'vitest';
import { selectStreaksToReset, type ResettableRecurringQuest } from './streak-reset';

// The day the daily tick judges: yesterday in the user's timezone, at UTC midnight.
// 2026-07-13 is a Monday, so 2026-07-12 is a Sunday.
const SUNDAY = new Date(Date.UTC(2026, 6, 12));
const MONDAY = new Date(Date.UTC(2026, 6, 13));

const CREATED = new Date(Date.UTC(2026, 5, 1)); // well before the judged day

function quest(
  overrides: Partial<ResettableRecurringQuest> & { id: string },
): ResettableRecurringQuest {
  return {
    recurrenceType: 'daily',
    recurrenceValue: null,
    createdAt: CREATED,
    ...overrides,
  };
}

function reset(params: {
  quests: ResettableRecurringQuest[];
  completed?: string[];
  streaks?: Record<string, number>;
  day?: Date;
}): string[] {
  return selectStreaksToReset({
    recurringQuests: params.quests,
    completedRecurringQuestIds: new Set(params.completed ?? []),
    currentStreaks: new Map(Object.entries(params.streaks ?? {})),
    day: params.day ?? SUNDAY,
  });
}

describe('selectStreaksToReset', () => {
  it('resets a daily quest that was required and left uncompleted', () => {
    expect(reset({ quests: [quest({ id: 'a' })], streaks: { a: 4 } })).toEqual(['a']);
  });

  it('leaves a quest that was completed on the judged day', () => {
    expect(
      reset({ quests: [quest({ id: 'a' })], completed: ['a'], streaks: { a: 4 } }),
    ).toEqual([]);
  });

  it('leaves a quest that was not required on the judged day', () => {
    // weekdays bitmask: bit 0 = Mon … bit 6 = Sun. Mon+Tue only → not due on a Sunday.
    const monTue = quest({ id: 'a', recurrenceType: 'weekdays', recurrenceValue: 0b0000011 });
    expect(reset({ quests: [monTue], streaks: { a: 4 } })).toEqual([]);
    // …and the same quest on the Monday it *is* due, with no completion, does reset.
    expect(reset({ quests: [monTue], streaks: { a: 4 }, day: MONDAY })).toEqual(['a']);
  });

  it('skips a streak that is already at zero — the tick stays idempotent on a re-run', () => {
    expect(reset({ quests: [quest({ id: 'a' })], streaks: { a: 0 } })).toEqual([]);
  });

  it('skips a quest with no streak row at all', () => {
    expect(reset({ quests: [quest({ id: 'a' })], streaks: {} })).toEqual([]);
  });

  it('honours every_x_days cadence: only off-cadence days with a running streak reset', () => {
    // Created 2026-06-01; every 3 days → due on 06-01, 06-04 … 07-12 (41 days later, 41 % 3 ≠ 0
    // → not due), while 07-13 is 42 days later (42 % 3 === 0 → due).
    const everyThree = quest({ id: 'a', recurrenceType: 'every_x_days', recurrenceValue: 3 });
    expect(reset({ quests: [everyThree], streaks: { a: 2 } })).toEqual([]);
    expect(reset({ quests: [everyThree], streaks: { a: 2 }, day: MONDAY })).toEqual(['a']);
  });

  it('selects only the failing quests out of a mixed batch', () => {
    const quests = [
      quest({ id: 'missed' }), // due, uncompleted, streak running → reset
      quest({ id: 'done' }), // due but completed → keep
      quest({ id: 'zeroed' }), // due, uncompleted, streak already 0 → nothing to do
      quest({ id: 'not-due', recurrenceType: 'weekdays', recurrenceValue: 0b0000001 }), // Mon only
    ];
    expect(
      reset({
        quests,
        completed: ['done'],
        streaks: { missed: 7, done: 7, zeroed: 0, 'not-due': 7 },
      }),
    ).toEqual(['missed']);
  });
});
