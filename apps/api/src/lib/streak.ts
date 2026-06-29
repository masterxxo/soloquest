import { and, eq } from 'drizzle-orm';
import {
  db,
  achievements,
  userAchievements,
  recurringQuestStreaks,
} from '@soloquest/db';

// Accepts both the top-level db (cron, plain requests) and the transaction handle
// drizzle hands to db.transaction(cb) (the completion flow). Both expose the same
// query-builder surface this module uses.
export type DrizzleDB =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Achievement = typeof achievements.$inferSelect;
type Streak = typeof recurringQuestStreaks.$inferSelect;

/**
 * Award any streak/total achievements the user has just crossed the threshold for,
 * scoped to a single recurring quest. Idempotent: already-earned achievements are
 * skipped, and the (user, achievement, quest) unique constraint backstops races.
 */
export async function checkAndAwardAchievements(
  database: DrizzleDB,
  userId: string,
  recurringQuestId: string,
  streak: Streak,
): Promise<{ newAchievements: Achievement[] }> {
  const allAchievements = await database.select().from(achievements);

  const earned = await database
    .select({ achievementId: userAchievements.achievementId })
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.recurringQuestId, recurringQuestId),
      ),
    );
  const earnedIds = new Set(earned.map((row) => row.achievementId));

  const newlyEarned = allAchievements.filter((a) => {
    if (earnedIds.has(a.id)) return false;
    if (a.type === 'streak') return streak.currentStreak >= a.threshold;
    if (a.type === 'total') return streak.totalCompletions >= a.threshold;
    return false;
  });

  if (newlyEarned.length === 0) return { newAchievements: [] };

  await database.insert(userAchievements).values(
    newlyEarned.map((a) => ({
      userId,
      achievementId: a.id,
      recurringQuestId,
    })),
  );

  return { newAchievements: newlyEarned };
}
