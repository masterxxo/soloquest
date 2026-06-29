import { schedule } from 'node-cron';
import { and, eq } from 'drizzle-orm';
import {
  recurringQuests,
  recurringQuestCompletions,
  recurringQuestStreaks,
  userSettings,
} from '@soloquest/db';
import type { DrizzleDB } from '../lib/streak';
import { getUserDate, toDateString, wasRequiredOn } from '../lib/recurrence';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * One daily pass: for each user, in their own timezone, find recurring quests that
 * were required *yesterday* but went uncompleted and reset their (active) streak.
 * Today is still in progress, so we only ever judge the day that has fully closed.
 */
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
      const [settings] = await db
        .select({ timezone: userSettings.timezone })
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      const timezone = settings?.timezone ?? 'UTC';

      const today = getUserDate(now, timezone);
      const yesterday = new Date(today.getTime() - MS_PER_DAY);
      const yesterdayStr = toDateString(yesterday);

      const quests = await db
        .select()
        .from(recurringQuests)
        .where(
          and(eq(recurringQuests.userId, userId), eq(recurringQuests.isActive, true)),
        );

      for (const quest of quests) {
        // Not due yesterday → a missing completion is expected, leave the streak.
        if (!wasRequiredOn(quest, yesterday)) continue;

        const [completion] = await db
          .select({ id: recurringQuestCompletions.id })
          .from(recurringQuestCompletions)
          .where(
            and(
              eq(recurringQuestCompletions.recurringQuestId, quest.id),
              eq(recurringQuestCompletions.completedDate, yesterdayStr),
            ),
          );
        if (completion) continue; // done yesterday → streak stands

        const [streak] = await db
          .select({ currentStreak: recurringQuestStreaks.currentStreak })
          .from(recurringQuestStreaks)
          .where(eq(recurringQuestStreaks.recurringQuestId, quest.id));

        if (streak && streak.currentStreak > 0) {
          await db
            .update(recurringQuestStreaks)
            .set({ currentStreak: 0 })
            .where(eq(recurringQuestStreaks.recurringQuestId, quest.id));
          console.log(`[cron] streak reset for quest ${quest.id}, user ${userId}`);
        }
      }

      processed++;
    } catch (err) {
      console.error(`[cron] failed for user ${userId}:`, err);
    }
  }

  console.log(`[cron] daily tick done, processed ${processed} users`);
}

/**
 * Register the daily tick at 03:00 UTC. node-cron defaults to the server's local
 * time, so we pin the timezone to UTC for a deterministic, deploy-independent run.
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
