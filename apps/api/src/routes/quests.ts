import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, quests, campaigns, user as userTable } from '@soloquest/db';
import {
  XP_REWARDS,
  levelFromTotalXp,
  compareDifficulty,
  type Difficulty,
  createQuestSchema,
  updateQuestSchema,
  questIdParamSchema,
  questListQuerySchema,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';

// Non-blocking rank sanity check: a quest/sub-task shouldn't out-rank its container.
// Returns human-readable warnings; it never rejects the write.
async function buildRankWarnings(
  userId: string,
  difficulty: Difficulty,
  campaignId?: string | null,
  parentId?: string | null,
): Promise<string[]> {
  const warnings: string[] = [];

  if (campaignId) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
    if (campaign && compareDifficulty(difficulty, campaign.difficulty) > 0) {
      warnings.push(
        `Quest rank (${difficulty}) exceeds Campaign rank (${campaign.difficulty})`,
      );
    }
  }

  if (parentId) {
    const [parent] = await db
      .select()
      .from(quests)
      .where(and(eq(quests.id, parentId), eq(quests.userId, userId)));
    if (parent && compareDifficulty(difficulty, parent.difficulty) > 0) {
      warnings.push(
        `Sub-task rank (${difficulty}) exceeds Quest rank (${parent.difficulty})`,
      );
    }
  }

  return warnings;
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

  // Create a quest. xpReward is derived server-side from difficulty; status defaults
  // to 'active'. The client never sends xpReward or status.
  .post('/', zValidator('json', createQuestSchema), async (c) => {
    const userId = c.get('user')!.id;
    const input = c.req.valid('json');
    const [created] = await db
      .insert(quests)
      .values({
        userId,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        xpReward: XP_REWARDS[input.difficulty],
        deadline: input.deadline,
        campaignId: input.campaignId,
        parentId: input.parentId,
      })
      .returning();

    const warnings = await buildRankWarnings(
      userId,
      input.difficulty,
      input.campaignId,
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

      const [existing] = await db
        .select()
        .from(quests)
        .where(and(eq(quests.id, id), eq(quests.userId, userId)));

      if (!existing) return c.json({ error: 'Quest not found' }, 404);
      // Closed quests are immutable — their XP has already been granted.
      if (existing.status !== 'active') {
        return c.json({ error: 'Only active quests can be edited' }, 409);
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

      // Warn against the effective difficulty and any container set in this request.
      const warnings = await buildRankWarnings(
        userId,
        input.difficulty ?? existing.difficulty,
        input.campaignId,
        input.parentId,
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
      const [quest] = await tx
        .select()
        .from(quests)
        .where(and(eq(quests.id, id), eq(quests.userId, sessionUser.id)));

      if (!quest) return { error: 'not_found' as const };
      if (quest.status === 'completed') return { error: 'already_completed' as const };

      // Read the authoritative xp/level from the DB inside the transaction.
      const [currentUser] = await tx
        .select()
        .from(userTable)
        .where(eq(userTable.id, sessionUser.id));

      const prevLevel = currentUser.level ?? 1;
      const newXp = (currentUser.xp ?? 0) + quest.xpReward;
      const { level: newLevel } = levelFromTotalXp(newXp);

      const [updatedQuest] = await tx
        .update(quests)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(quests.id, id))
        .returning();

      await tx
        .update(userTable)
        .set({ xp: newXp, level: newLevel })
        .where(eq(userTable.id, sessionUser.id));

      return {
        quest: updatedQuest,
        player: { xp: newXp, level: newLevel },
        leveledUp: newLevel > prevLevel,
      };
    });

    if ('error' in result) {
      return result.error === 'not_found'
        ? c.json({ error: 'Quest not found' }, 404)
        : c.json({ error: 'Quest already completed' }, 409);
    }

    return c.json(result);
  });
