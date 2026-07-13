import { schedule } from 'node-cron';
import { and, eq, inArray } from 'drizzle-orm';
import {
  recurringQuests,
  recurringQuestCompletions,
  recurringQuestStreaks,
} from '@soloquest/db/schema';
import type { DrizzleDB } from '../lib/db';
import { MS_PER_DAY } from '../lib/constants';
import { getUserDate, toDateString } from '../lib/recurrence';
import { getUserTimezone } from '../lib/user-settings';
import { selectStreaksToReset } from '../lib/streak-reset';

/**
 * One user's pass: in their own timezone, find the recurring quests that were required
 * *yesterday* but went uncompleted and reset their (running) streak. Today is still in
 * progress, so we only ever judge the day that has fully closed.
 *
 * Three queries + at most one write, regardless of how many rituals the user has: the
 * completions and streaks are fetched in bulk and joined in memory (see
 * selectStreaksToReset), and the resets go out as a single UPDATE.
 */
async function runUserTick(db: DrizzleDB, userId: string, now: Date): Promise<void> {
  const timezone = await getUserTimezone(db, userId);
  const today = getUserDate(now, timezone);
  const yesterday = new Date(today.getTime() - MS_PER_DAY);
  const yesterdayStr = toDateString(yesterday);

  const rituals = await db
    .select()
    .from(recurringQuests)
    .where(and(eq(recurringQuests.userId, userId), eq(recurringQuests.isActive, true)));
  if (rituals.length === 0) return;

  const ritualIds = rituals.map((ritual) => ritual.id);

  const completions = await db
    .select({ recurringQuestId: recurringQuestCompletions.recurringQuestId })
    .from(recurringQuestCompletions)
    .where(
      and(
        inArray(recurringQuestCompletions.recurringQuestId, ritualIds),
        eq(recurringQuestCompletions.completedDate, yesterdayStr),
      ),
    );

  const streaks = await db
    .select({
      recurringQuestId: recurringQuestStreaks.recurringQuestId,
      currentStreak: recurringQuestStreaks.currentStreak,
    })
    .from(recurringQuestStreaks)
    .where(inArray(recurringQuestStreaks.recurringQuestId, ritualIds));

  const toReset = selectStreaksToReset({
    rituals,
    completedRitualIds: new Set(completions.map((row) => row.recurringQuestId)),
    currentStreaks: new Map(streaks.map((row) => [row.recurringQuestId, row.currentStreak])),
    day: yesterday,
  });
  if (toReset.length === 0) return;

  await db
    .update(recurringQuestStreaks)
    .set({ currentStreak: 0 })
    .where(inArray(recurringQuestStreaks.recurringQuestId, toReset));

  console.log(
    `[cron] reset ${toReset.length} streak(s) for user ${userId} (missed ${yesterdayStr}): ${toReset.join(', ')}`,
  );
}

/** One daily pass over every user that owns at least one active recurring quest. */
async function runDailyTick(db: DrizzleDB): Promise<void> {
  // Only users with at least one active recurring quest are worth processing.
  const userRows = await db
    .selectDistinct({ userId: recurringQuests.userId })
    .from(recurringQuests)
    .where(eq(recurringQuests.isActive, true));

  const now = new Date();
  let processed = 0;

  for (const { userId } of userRows) {
    // One user's failure must not abort the rest of the tick.
    try {
      await runUserTick(db, userId, now);
      processed++;
    } catch (err) {
      console.error(`[cron] failed for user ${userId}:`, err);
    }
  }

  console.log(`[cron] daily tick done, processed ${processed} users`);
}

/**
 * Register the daily tick at 03:00 UTC. node-cron defaults to the server's local
 * time, so we pin the schedule's timezone for a deterministic, deploy-independent run.
 * This 'UTC' is the *schedule's* wall clock, unrelated to a user's DEFAULT_TIMEZONE —
 * each user's day boundary is still derived from their own settings inside the tick.
 */
export function startDailyCron(db: DrizzleDB): void {
  schedule(
    '0 3 * * *',
    () => {
      void runDailyTick(db).catch((err) => {
        console.error('[cron] daily tick crashed:', err);
      });
    },
    { timezone: 'UTC' },
  );
  console.log('[cron] daily tick scheduled for 03:00 UTC');
}
