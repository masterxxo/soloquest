import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { tags, questTags } from '@soloquest/db/schema';
import { normalizeTagName, tagColorForName, type TagColor } from '@soloquest/shared';
import type { DrizzleDB } from './db';

export type Tag = typeof tags.$inferSelect;

// A tag plus how many quests currently pin it — what the tag-management screen lists.
// usageCount counts EVERY existing quest carrying the tag, of any status: completing a quest
// keeps its row and its pin, so the count is unchanged by completion and only moves on quest
// create / update / delete. (See the tags store's invalidation notes.)
export interface TagWithUsage {
  id: string;
  name: string;
  normalizedName: string;
  color: TagColor;
  createdAt: Date;
  usageCount: number;
}

/**
 * Fetch a tag only when it belongs to `userId`; otherwise null. The one place the
 * "is this tag mine" check lives, mirroring findOwnedQuest.
 */
export async function findOwnedTag(
  db: DrizzleDB,
  id: string,
  userId: string,
): Promise<Tag | null> {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)));
  return tag ?? null;
}

/**
 * A user's tags, ordered by display name (case-insensitive), each with its usage count
 * (number of quests pinning it). One grouped query — no per-tag count round-trip.
 */
export async function listUserTags(db: DrizzleDB, userId: string): Promise<TagWithUsage[]> {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      normalizedName: tags.normalizedName,
      color: tags.color,
      createdAt: tags.createdAt,
      usageCount: sql<number>`count(${questTags.questId})`.mapWith(Number),
    })
    .from(tags)
    .leftJoin(questTags, eq(questTags.tagId, tags.id))
    .where(eq(tags.userId, userId))
    .groupBy(tags.id)
    .orderBy(asc(sql`lower(${tags.name})`));
}

/**
 * Create a tag, or return the existing one on a normalized-name collision. Create-or-return
 * (not create-or-error) is what makes on-the-fly creation race-free: two tabs both "creating"
 * `Dom` end up pinning the same row instead of one 409-ing. `name` stores the spelling as
 * typed; `normalizedName` is the comparison key.
 */
export async function createOrGetTag(
  db: DrizzleDB,
  userId: string,
  rawName: string,
  color?: TagColor,
): Promise<Tag> {
  const name = rawName.trim();
  const normalizedName = normalizeTagName(rawName);
  // No colour chosen → derive a stable one from the name, so ten tags created in a row don't
  // all share a shade. An explicit colour (already palette-validated by Zod) wins.
  const resolvedColor = color ?? tagColorForName(normalizedName);

  const [created] = await db
    .insert(tags)
    .values({ userId, name, normalizedName, color: resolvedColor })
    .onConflictDoNothing({ target: [tags.userId, tags.normalizedName] })
    .returning();
  if (created) return created;

  // Lost the insert to the unique constraint — the row already exists, so hand it back.
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)));
  if (!existing) throw new Error('Tag vanished after conflict');
  return existing;
}

/**
 * Update a tag's name and/or colour, scoped to the owner. Returns a guarded union so the
 * route maps each outcome to a status:
 *   not_found  → 404 (missing or not the caller's)
 *   name_taken → 409 (a *different* tag already normalizes to the new name)
 * A rename that only changes casing (`dom` → `Dom`) is allowed — it collides with itself.
 * A colour-only change never touches name/normalizedName (or the pins).
 */
export async function updateTag(
  db: DrizzleDB,
  userId: string,
  id: string,
  patch: { name?: string; color?: TagColor },
): Promise<{ tag: Tag } | { error: 'not_found' | 'name_taken' }> {
  const existing = await findOwnedTag(db, id, userId);
  if (!existing) return { error: 'not_found' };

  const set: Partial<Pick<Tag, 'name' | 'normalizedName' | 'color'>> = {};

  if (patch.name !== undefined) {
    const normalizedName = normalizeTagName(patch.name);
    const [clash] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)));
    if (clash && clash.id !== id) return { error: 'name_taken' };
    set.name = patch.name.trim();
    set.normalizedName = normalizedName;
  }
  if (patch.color !== undefined) set.color = patch.color;

  // Nothing to change (the route guards the all-undefined case, but stay total).
  if (Object.keys(set).length === 0) return { tag: existing };

  const [updated] = await db
    .update(tags)
    .set(set)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning();
  if (!updated) throw new Error('Failed to update tag');
  return { tag: updated };
}

/**
 * Delete a tag scoped to the owner. Its quest_tags rows disappear via ON DELETE cascade;
 * the quests themselves are untouched. Returns whether a row was actually removed.
 */
export async function deleteTag(db: DrizzleDB, userId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .returning();
  return Boolean(deleted);
}

/**
 * The tags pinned to a quest as `{ id, name, color }`, ordered by name. Used to echo a quest's
 * tags back on its create/update response (the list GET builds them via a relational query).
 */
export async function getQuestTags(
  db: DrizzleDB,
  questId: string,
): Promise<{ id: string; name: string; color: TagColor }[]> {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(questTags)
    .innerJoin(tags, eq(tags.id, questTags.tagId))
    .where(eq(questTags.questId, questId))
    .orderBy(asc(sql`lower(${tags.name})`));
}

/**
 * True iff every id in `tagIds` is a tag owned by `userId`. Duplicate ids collapse; an
 * empty list is trivially owned. The gate before pinning any tag to a quest — a foreign
 * tag must be rejected, never silently dropped.
 */
export async function assertOwnedTags(
  db: DrizzleDB,
  userId: string,
  tagIds: string[],
): Promise<boolean> {
  const wanted = new Set(tagIds);
  if (wanted.size === 0) return true;
  const owned = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.id, [...wanted])));
  return owned.length === wanted.size;
}

/**
 * Set a quest's tags to exactly `tagIds` (replace, not append): drop the current pins and
 * insert the new set. Runs inside a transaction so a quest is never left half-tagged.
 * Callers that already hold a transaction pass it as `db`.
 */
export async function replaceQuestTags(
  db: DrizzleDB,
  questId: string,
  tagIds: string[],
): Promise<void> {
  await db.delete(questTags).where(eq(questTags.questId, questId));
  const unique = [...new Set(tagIds)];
  if (unique.length > 0) {
    await db.insert(questTags).values(unique.map((tagId) => ({ questId, tagId })));
  }
}

/**
 * Ownership-checked replace of a quest's tags. Returns `{ error: 'foreign_tag' }` (writing
 * nothing) if any id isn't the caller's; otherwise replaces the set atomically. Used by the
 * quest PATCH route and exercised directly in tests.
 */
export async function setQuestTags(
  db: DrizzleDB,
  userId: string,
  questId: string,
  tagIds: string[],
): Promise<{ ok: true } | { error: 'foreign_tag' }> {
  if (!(await assertOwnedTags(db, userId, tagIds))) return { error: 'foreign_tag' };
  await db.transaction(async (tx) => {
    await replaceQuestTags(tx, questId, tagIds);
  });
  return { ok: true };
}
