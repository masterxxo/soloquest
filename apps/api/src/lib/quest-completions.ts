import { count, eq } from 'drizzle-orm';
import { questCompletions } from '@soloquest/db/schema';
import type { DrizzleDB } from './db';
import type { Quest } from './quests';

export type QuestCompletionInsert = typeof questCompletions.$inferInsert;

/**
 * Build the completion event for a quest that is being completed right now.
 *
 * Title, difficulty and XP are copied out of the quest rather than referenced through
 * `questId`: the FK is `SET NULL`, so the event outlives the quest, and it has to carry
 * enough of the quest with it to still make sense on its own. `xpAwarded` is the XP the
 * player actually received, not `XP_REWARDS[difficulty]` recomputed later — the reward
 * table may change, but what was granted at the time must not.
 */
export function buildQuestCompletion(
  quest: Quest,
  xpAwarded: number,
  completedAt: Date,
): QuestCompletionInsert {
  return {
    userId: quest.userId,
    questId: quest.id,
    title: quest.title,
    difficulty: quest.difficulty,
    xpAwarded,
    completedAt,
  };
}

/**
 * Lifetime number of quests the user has completed. Counted in the database — the rows
 * are an append-only log that only grows, so there is nothing to fetch and tally client-side.
 */
export async function countQuestCompletions(
  database: DrizzleDB,
  userId: string,
): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(questCompletions)
    .where(eq(questCompletions.userId, userId));
  return row?.total ?? 0;
}
