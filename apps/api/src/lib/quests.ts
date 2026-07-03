import { and, eq } from 'drizzle-orm';
import { quests } from '@soloquest/db';
import type { DrizzleDB } from './db';

export type Quest = typeof quests.$inferSelect;

/**
 * Fetch a quest only when it belongs to `userId`; otherwise null. Centralizes the
 * "scope every read to the owner" rule so ownership can't be forgotten (e.g. when
 * validating a parentId before nesting a quest under it).
 */
export async function findOwnedQuest(
  database: DrizzleDB,
  id: string,
  userId: string,
): Promise<Quest | null> {
  const [quest] = await database
    .select()
    .from(quests)
    .where(and(eq(quests.id, id), eq(quests.userId, userId)));
  return quest ?? null;
}
