import { Hono } from 'hono';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@soloquest/db/client';
import { questCompletions, quests } from '@soloquest/db/schema';
import {
  XP_REWARDS,
  type Difficulty,
  createQuestSchema,
  updateQuestSchema,
  questIdParamSchema,
  questListQuerySchema,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import { grantXp } from '../lib/xp';
import { findOwnedQuest } from '../lib/quests';
import { buildQuestCompletion, countQuestCompletions } from '../lib/quest-completions';
import { effectiveParentId, rankWarnings } from '../lib/rank';
import { zValidator } from '../lib/validate';

// Loads the parent (scoped to the owner) and defers the rule itself to rankWarnings.
async function buildRankWarnings(
  userId: string,
  difficulty: Difficulty,
  parentId: string | null | undefined,
): Promise<string[]> {
  const parent = parentId ? await findOwnedQuest(db, parentId, userId) : null;
  return rankWarnings(difficulty, parent);
}

// Chained so Hono RPC can infer the route types end-to-end.
export const questsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // List the current user's quests. Optional filters: status, parentId
  // ("null" → top-level only, a uuid → that quest's sub-tasks). include=subTasks
  // nests each quest's sub-tasks under it.
  .get('/', zValidator('query', questListQuerySchema), async (c) => {
    const userId = c.get('user')!.id;
    const { status, parentId, include } = c.req.valid('query');

    const conditions = [eq(quests.userId, userId)];
    if (status) conditions.push(eq(quests.status, status));
    if (parentId === 'null') conditions.push(isNull(quests.parentId));
    else if (parentId) conditions.push(eq(quests.parentId, parentId));

    const rows = await db.query.quests.findMany({
      where: and(...conditions),
      orderBy: desc(quests.createdAt),
      ...(include === 'subTasks' ? { with: { subTasks: true } } : {}),
    });
    return c.json(rows);
  })

  // Lifetime quest counters for the current user, read from the completion log rather
  // than from the quests table — deleting a completed quest must not lower the count.
  // Shaped as an object so further counters can be added as fields without a new route.
  // (Recurring quests keep their own log and are deliberately not counted here.)
  .get('/stats', async (c) => {
    const userId = c.get('user')!.id;
    const totalCompleted = await countQuestCompletions(db, userId);
    return c.json({ totalCompleted });
  })

  // Create a quest. xpReward is derived server-side from difficulty; status defaults
  // to 'active'. The client never sends xpReward or status.
  .post('/', zValidator('json', createQuestSchema), async (c) => {
    const userId = c.get('user')!.id;
    const input = c.req.valid('json');

    // A parent must exist and belong to the caller — never nest under a foreign quest.
    if (input.parentId) {
      const parent = await findOwnedQuest(db, input.parentId, userId);
      if (!parent) return c.json({ error: 'Parent quest not found' }, 404);
    }

    const [created] = await db
      .insert(quests)
      .values({
        userId,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        xpReward: XP_REWARDS[input.difficulty],
        deadline: input.deadline,
        parentId: input.parentId,
      })
      .returning();
    if (!created) throw new Error('Failed to create quest');

    const warnings = await buildRankWarnings(
      userId,
      input.difficulty,
      input.parentId,
    );
    return c.json({ quest: created, warnings }, 201);
  })

  // Partial edit, scoped to the owner. If difficulty changes, xpReward is recomputed
  // server-side so it stays authoritative. Status is not editable here (see /complete).
  .patch(
    '/:id',
    zValidator('param', questIdParamSchema),
    zValidator('json', updateQuestSchema),
    async (c) => {
      const userId = c.get('user')!.id;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      if (Object.keys(input).length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      const existing = await findOwnedQuest(db, id, userId);
      if (!existing) return c.json({ error: 'Quest not found' }, 404);
      // Closed quests are immutable — their XP has already been granted.
      if (existing.status !== 'active') {
        return c.json({ error: 'Only active quests can be edited' }, 409);
      }

      // A re-parenting request must point at one of the caller's own quests.
      if (input.parentId) {
        const parent = await findOwnedQuest(db, input.parentId, userId);
        if (!parent) return c.json({ error: 'Parent quest not found' }, 404);
      }

      const [updated] = await db
        .update(quests)
        .set({
          ...input,
          // Keep xpReward authoritative when the difficulty changes.
          ...(input.difficulty ? { xpReward: XP_REWARDS[input.difficulty] } : {}),
        })
        .where(and(eq(quests.id, id), eq(quests.userId, userId)))
        .returning();
      if (!updated) throw new Error('Failed to update quest');

      // Warn against the *effective* quest after this PATCH — both the difficulty and the
      // parent it ends up with. A PATCH that only raises the difficulty of an existing
      // sub-task must still warn, so an omitted parentId falls back to the stored one.
      const warnings = await buildRankWarnings(
        userId,
        input.difficulty ?? existing.difficulty,
        effectiveParentId(input.parentId, existing.parentId),
      );
      return c.json({ quest: updated, warnings });
    },
  )

  // Delete, scoped to the owner.
  .delete('/:id', zValidator('param', questIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');
    const [deleted] = await db
      .delete(quests)
      .where(and(eq(quests.id, id), eq(quests.userId, userId)))
      .returning();

    if (!deleted) return c.json({ error: 'Quest not found' }, 404);
    return c.json({ success: true });
  })

  // Complete a quest and grant XP atomically (server-authoritative).
  .post('/:id/complete', zValidator('param', questIdParamSchema), async (c) => {
    const sessionUser = c.get('user')!;
    const { id } = c.req.valid('param');

    const result = await db.transaction(async (tx) => {
      const quest = await findOwnedQuest(tx, id, sessionUser.id);
      if (!quest) return { error: 'not_found' as const };
      if (quest.status === 'completed') return { error: 'already_completed' as const };

      // One timestamp for both writes, so the quest and its completion event agree.
      const completedAt = new Date();

      const [updatedQuest] = await tx
        .update(quests)
        .set({ status: 'completed', completedAt })
        .where(eq(quests.id, id))
        .returning();
      if (!updatedQuest) throw new Error('Failed to complete quest');

      // Server-authoritative XP: atomic increment + derived level, inside this tx.
      const player = await grantXp(tx, sessionUser.id, quest.xpReward);

      // Append the completion event in the same transaction: status, XP and the log
      // move together or not at all — a granted-but-unlogged completion would silently
      // undercount the player's history forever.
      await tx
        .insert(questCompletions)
        .values(buildQuestCompletion(quest, quest.xpReward, completedAt));

      return {
        quest: updatedQuest,
        player: { xp: player.xp, level: player.level },
        leveledUp: player.leveledUp,
      };
    });

    if ('error' in result) {
      return result.error === 'not_found'
        ? c.json({ error: 'Quest not found' }, 404)
        : c.json({ error: 'Quest already completed' }, 409);
    }

    return c.json(result);
  });
