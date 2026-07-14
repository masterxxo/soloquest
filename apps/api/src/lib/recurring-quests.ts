import { and, eq } from 'drizzle-orm';
import { recurringQuests } from '@soloquest/db/schema';
import type { DrizzleDB } from './db';

export type RecurringQuest = typeof recurringQuests.$inferSelect;

/**
 * Twin of findOwnedQuest for recurring quests: fetch a recurring quest only when it belongs to
 * `userId`; otherwise null. Keeps the "scope every read to the owner" rule in one place.
 */
export async function findOwnedRecurringQuest(
  database: DrizzleDB,
  id: string,
  userId: string,
): Promise<RecurringQuest | null> {
  const [quest] = await database
    .select()
    .from(recurringQuests)
    .where(and(eq(recurringQuests.id, id), eq(recurringQuests.userId, userId)));
  return quest ?? null;
}
