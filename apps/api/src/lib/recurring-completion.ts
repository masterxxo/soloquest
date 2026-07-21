import { eq } from 'drizzle-orm';
import { recurringQuestCompletions, recurringQuestStreaks } from '@soloquest/db/schema';
import { RECURRING_XP_REWARD, MAX_BACKFILL_DAYS } from '@soloquest/shared';
import type { DrizzleDB } from './db';
import type { RecurringQuest } from './recurring-quests';
import {
  getUserDate,
  toDateString,
  fromDateString,
  wasRequiredOn,
  isCompletableDate,
  isWithinBackfillWindow,
  recalculateStreak,
} from './recurrence';
import { grantXp } from './xp';
import { checkAndAwardAchievements } from './streak';

// Why the completion was refused, mapped to an HTTP status by the route:
//   not_active     → the ritual is soft-deleted            (409)
//   out_of_range   → future, or before the ritual existed  (400)
//   out_of_window  → older than the backfill window        (400)
//   not_required   → the ritual was not due on that day    (400)
//   already_completed → the day is already recorded        (409, reused from today's path)
export type BackfillError =
  | 'not_active'
  | 'out_of_range'
  | 'out_of_window'
  | 'not_required'
  | 'already_completed';

export type CompleteRecurringResult =
  | { error: BackfillError }
  | {
      completion: typeof recurringQuestCompletions.$inferSelect;
      streak: { currentStreak: number; longestStreak: number; totalCompletions: number };
      player: { xp: number; level: number };
      leveledUp: boolean;
      newAchievements: Awaited<
        ReturnType<typeof checkAndAwardAchievements>
      >['newAchievements'];
    };

/**
 * Complete a recurring quest for a specific calendar day — the single path behind both
 * "complete today" and "backfill a missed day". `today` and `completedDate` are the
 * user's local day ('YYYY-MM-DD'); `timezone` lets us derive the ritual's own start day
 * in that same frame. All date reasoning is here (never in SQL) so it stays timezone-safe.
 *
 * The streak is *recalculated* from the full completion set after the insert, not nudged
 * incrementally — that is what makes filling a gap in the middle of a run rejoin it, and
 * it uses the same `wasRequiredOn` predicate the cron and heatmap do, so the three can't
 * drift apart. The insert-first / onConflictDoNothing dance is unchanged: the unique
 * (quest, date) constraint arbitrates concurrent requests, and we bail before any XP,
 * streak or achievement side effect if we lost the race.
 */
export async function completeRecurringQuestForDate(
  db: DrizzleDB,
  params: {
    quest: RecurringQuest;
    userId: string;
    completedDate: string;
    today: string;
    timezone: string;
  },
): Promise<CompleteRecurringResult> {
  const { quest, userId, completedDate, today, timezone } = params;

  if (!quest.isActive) return { error: 'not_active' };

  // Anchor every bound through getUserDate so today, the ritual's start day, and the
  // target day all live in one frame (the user's local calendar) — no UTC/local mixing.
  const createdDate = toDateString(getUserDate(quest.createdAt, timezone));
  if (!isCompletableDate(completedDate, today, createdDate)) return { error: 'out_of_range' };
  if (!isWithinBackfillWindow(completedDate, today, MAX_BACKFILL_DAYS)) {
    return { error: 'out_of_window' };
  }
  if (!wasRequiredOn(quest, fromDateString(completedDate))) return { error: 'not_required' };

  return db.transaction(async (tx) => {
    const [completion] = await tx
      .insert(recurringQuestCompletions)
      .values({ recurringQuestId: quest.id, userId, completedDate })
      .onConflictDoNothing()
      .returning();
    if (!completion) return { error: 'already_completed' as const };

    // Read the current streak (created at POST; recreated defensively if missing) — kept
    // as a longest-streak floor so a recalculation can never lower a past record.
    let [streak] = await tx
      .select()
      .from(recurringQuestStreaks)
      .where(eq(recurringQuestStreaks.recurringQuestId, quest.id));
    if (!streak) {
      [streak] = await tx
        .insert(recurringQuestStreaks)
        .values({ recurringQuestId: quest.id, userId })
        .returning();
    }
    if (!streak) throw new Error('Failed to load or create streak');

    // Recalculate from the full completion set (the just-inserted row included).
    const allCompletions = await tx
      .select({ completedDate: recurringQuestCompletions.completedDate })
      .from(recurringQuestCompletions)
      .where(eq(recurringQuestCompletions.recurringQuestId, quest.id));
    const completedDates = new Set(allCompletions.map((row) => row.completedDate));

    const questStart = getUserDate(quest.createdAt, timezone);
    const recalculated = recalculateStreak(
      quest,
      completedDates,
      questStart,
      fromDateString(today),
    );

    const [updatedStreak] = await tx
      .update(recurringQuestStreaks)
      .set({
        currentStreak: recalculated.currentStreak,
        longestStreak: Math.max(streak.longestStreak, recalculated.longestStreak),
        totalCompletions: recalculated.totalCompletions,
        lastCompletedDate: recalculated.lastCompletedDate,
      })
      .where(eq(recurringQuestStreaks.recurringQuestId, quest.id))
      .returning();
    if (!updatedStreak) throw new Error('Failed to update streak');

    // Server-authoritative XP: flat reward via the shared atomic helper — the same path
    // (and the same amount) whether the day is today or a backfilled one.
    const player = await grantXp(tx, userId, RECURRING_XP_REWARD);

    const { newAchievements } = await checkAndAwardAchievements(tx, userId, quest.id, updatedStreak);

    return {
      completion,
      streak: {
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
        totalCompletions: updatedStreak.totalCompletions,
      },
      player: { xp: player.xp, level: player.level },
      leveledUp: player.leveledUp,
      newAchievements,
    };
  });
}
