import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  recurringQuests,
  recurringQuestCompletions,
  recurringQuestStreaks,
  user,
} from '@soloquest/db/schema';
import { RECURRING_XP_REWARD } from '@soloquest/shared';
import { createTestDb, type TestDb } from '../test/db';
import { completeRecurringQuestForDate, type CompleteRecurringResult } from './recurring-completion';
import type { DrizzleDB } from './db';

// Backfilling + streak recalculation on a real (pglite) database and the real transaction —
// nothing about `db`, `grantXp` or the streak/completion writes is mocked. Streak is the
// kind of logic that breaks silently, so every case asserts the observable trio at once:
// the completion rows, the streak counters, and the player's XP.

const WEEKDAYS_MWF = 0b0010101; // Mon + Wed + Fri (bit 0 = Mon … bit 6 = Sun)

async function seedUser(db: DrizzleDB, id: string, xp = 0): Promise<void> {
  await db.insert(user).values({ id, name: `Hunter ${id}`, email: `${id}@example.com`, xp });
}

interface SeedQuest {
  userId: string;
  recurrenceType: 'daily' | 'every_x_days' | 'weekdays';
  recurrenceValue?: number | null;
  createdAt: Date;
  isActive?: boolean;
}

async function seedQuest(db: DrizzleDB, opts: SeedQuest) {
  const [q] = await db
    .insert(recurringQuests)
    .values({
      userId: opts.userId,
      title: 'Meditate',
      recurrenceType: opts.recurrenceType,
      recurrenceValue: opts.recurrenceValue ?? null,
      createdAt: opts.createdAt,
      isActive: opts.isActive ?? true,
    })
    .returning();
  // A streak row is created alongside the quest by the POST route in prod — mirror that.
  await db.insert(recurringQuestStreaks).values({ recurringQuestId: q!.id, userId: opts.userId });
  return q!;
}

async function getStreak(db: DrizzleDB, questId: string) {
  const [s] = await db
    .select()
    .from(recurringQuestStreaks)
    .where(eq(recurringQuestStreaks.recurringQuestId, questId));
  return s!;
}
async function getCompletionDates(db: DrizzleDB, questId: string): Promise<string[]> {
  const rows = await db
    .select({ completedDate: recurringQuestCompletions.completedDate })
    .from(recurringQuestCompletions)
    .where(eq(recurringQuestCompletions.recurringQuestId, questId));
  return rows.map((r) => r.completedDate).sort();
}
async function getXp(db: DrizzleDB, userId: string): Promise<number> {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  return u!.xp ?? 0;
}

function expectSuccess(result: CompleteRecurringResult): Exclude<CompleteRecurringResult, { error: string }> {
  if ('error' in result) throw new Error(`expected success, got ${result.error}`);
  return result;
}

describe('completeRecurringQuestForDate', () => {
  const USER = 'user-a';
  let test: TestDb;
  let db: DrizzleDB;

  beforeEach(async () => {
    test = await createTestDb();
    db = test.db;
    await seedUser(db, USER);
  });
  afterEach(async () => {
    await test.close();
  });

  it('1. backfilling a gap in the middle of a run rejoins the streak', async () => {
    // Daily ritual. Complete Mon 07-13 and Wed 07-15 (Tue 07-14 skipped → streak broken),
    // then backfill Tue: current must span the whole Mon–Wed run, not restart at 1.
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'daily',
      createdAt: new Date(Date.UTC(2026, 6, 1)),
    });
    const complete = (completedDate: string) =>
      completeRecurringQuestForDate(db, {
        quest,
        userId: USER,
        completedDate,
        today: '2026-07-15',
        timezone: 'UTC',
      });

    expectSuccess(await complete('2026-07-13'));
    expectSuccess(await complete('2026-07-15'));
    // With Tue missing, the current run is only Wed (today, now done).
    expect((await getStreak(db, quest.id)).currentStreak).toBe(1);

    const filled = expectSuccess(await complete('2026-07-14'));

    expect(filled.streak.currentStreak).toBe(3); // Mon–Tue–Wed, rejoined
    expect(filled.streak.totalCompletions).toBe(3);
    expect(filled.streak.longestStreak).toBe(3);

    const streak = await getStreak(db, quest.id);
    expect(streak.currentStreak).toBe(3);
    expect(streak.totalCompletions).toBe(3);
    expect(streak.lastCompletedDate).toBe('2026-07-15'); // latest, not the just-inserted Tue
    expect(await getCompletionDates(db, quest.id)).toEqual(['2026-07-13', '2026-07-14', '2026-07-15']);
    expect(await getXp(db, USER)).toBe(3 * RECURRING_XP_REWARD);
  });

  it('2. a day older than the backfill window is refused, with no side effects', async () => {
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'daily',
      createdAt: new Date(Date.UTC(2026, 5, 1)),
    });
    // 8 days before today (window is 7) → out of window.
    const result = await completeRecurringQuestForDate(db, {
      quest,
      userId: USER,
      completedDate: '2026-07-07',
      today: '2026-07-15',
      timezone: 'UTC',
    });

    expect(result).toEqual({ error: 'out_of_window' });
    expect(await getCompletionDates(db, quest.id)).toEqual([]);
    expect(await getStreak(db, quest.id)).toMatchObject({ currentStreak: 0, totalCompletions: 0 });
    expect(await getXp(db, USER)).toBe(0);
  });

  it('3. a day the ritual was not due on is refused', async () => {
    // Mon/Wed/Fri ritual; 2026-07-12 is a Sunday → not required.
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'weekdays',
      recurrenceValue: WEEKDAYS_MWF,
      createdAt: new Date(Date.UTC(2026, 5, 1)),
    });
    const result = await completeRecurringQuestForDate(db, {
      quest,
      userId: USER,
      completedDate: '2026-07-12',
      today: '2026-07-13',
      timezone: 'UTC',
    });

    expect(result).toEqual({ error: 'not_required' });
    expect(await getCompletionDates(db, quest.id)).toEqual([]);
    expect(await getXp(db, USER)).toBe(0);
  });

  it('4. an already-completed day returns already_completed with no duplicate or double XP', async () => {
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'daily',
      createdAt: new Date(Date.UTC(2026, 6, 1)),
    });
    expectSuccess(
      await completeRecurringQuestForDate(db, {
        quest,
        userId: USER,
        completedDate: '2026-07-13',
        today: '2026-07-14',
        timezone: 'UTC',
      }),
    );

    const again = await completeRecurringQuestForDate(db, {
      quest,
      userId: USER,
      completedDate: '2026-07-13',
      today: '2026-07-14',
      timezone: 'UTC',
    });

    expect(again).toEqual({ error: 'already_completed' });
    expect(await getCompletionDates(db, quest.id)).toEqual(['2026-07-13']); // UNIQUE held
    expect(await getXp(db, USER)).toBe(RECURRING_XP_REWARD); // granted once
  });

  it('5. a future day is refused', async () => {
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'daily',
      createdAt: new Date(Date.UTC(2026, 6, 1)),
    });
    const result = await completeRecurringQuestForDate(db, {
      quest,
      userId: USER,
      completedDate: '2026-07-14',
      today: '2026-07-13',
      timezone: 'UTC',
    });

    expect(result).toEqual({ error: 'out_of_range' });
    expect(await getCompletionDates(db, quest.id)).toEqual([]);
    expect(await getXp(db, USER)).toBe(0);
  });

  it('6. a valid backfill grants exactly the flat reward, once', async () => {
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'daily',
      createdAt: new Date(Date.UTC(2026, 6, 1)),
    });
    const result = expectSuccess(
      await completeRecurringQuestForDate(db, {
        quest,
        userId: USER,
        completedDate: '2026-07-13',
        today: '2026-07-15',
        timezone: 'UTC',
      }),
    );

    expect(result.player.xp).toBe(RECURRING_XP_REWARD);
    expect(await getXp(db, USER)).toBe(RECURRING_XP_REWARD);
    expect(await getCompletionDates(db, quest.id)).toEqual(['2026-07-13']);
  });

  it('7. recalculation matches the incremental "today" case: a clean run counts up 1,2,3', async () => {
    // Completing each due day as it becomes "today" must yield current = number of
    // consecutive days — the same result the old incremental update produced.
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'daily',
      createdAt: new Date(Date.UTC(2026, 6, 13)),
    });
    const days = ['2026-07-13', '2026-07-14', '2026-07-15'];
    for (const [i, day] of days.entries()) {
      const r = expectSuccess(
        await completeRecurringQuestForDate(db, {
          quest,
          userId: USER,
          completedDate: day,
          today: day, // each completed on its own day
          timezone: 'UTC',
        }),
      );
      expect(r.streak.currentStreak).toBe(i + 1);
    }
    expect(await getStreak(db, quest.id)).toMatchObject({
      currentStreak: 3,
      longestStreak: 3,
      totalCompletions: 3,
    });
  });

  it('8. the ritual start day is derived in the user timezone, not UTC', async () => {
    // createdAt is 2026-07-01 20:00 UTC = 2026-07-02 05:00 in Tokyo, so the ritual's first
    // valid day is 07-02 for a Tokyo user. 07-01 (its UTC day) must be rejected as before-range.
    const quest = await seedQuest(db, {
      userId: USER,
      recurrenceType: 'daily',
      createdAt: new Date(Date.UTC(2026, 6, 1, 20, 0)),
    });

    const beforeStart = await completeRecurringQuestForDate(db, {
      quest,
      userId: USER,
      completedDate: '2026-07-01',
      today: '2026-07-02',
      timezone: 'Asia/Tokyo',
    });
    expect(beforeStart).toEqual({ error: 'out_of_range' });

    const onStart = expectSuccess(
      await completeRecurringQuestForDate(db, {
        quest,
        userId: USER,
        completedDate: '2026-07-02',
        today: '2026-07-02',
        timezone: 'Asia/Tokyo',
      }),
    );
    expect(onStart.streak.currentStreak).toBe(1);
    expect(await getCompletionDates(db, quest.id)).toEqual(['2026-07-02']);
  });
});
