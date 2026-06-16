import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { db, quests, user as userTable } from '@soloquest/db';
import {
  XP_REWARDS,
  levelFromTotalXp,
  createQuestSchema,
  updateQuestSchema,
  questIdParamSchema,
  questListQuerySchema,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';

// Chained so Hono RPC can infer the route types end-to-end.
export const questsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // List the current user's quests, optionally filtered by status.
  .get('/', zValidator('query', questListQuerySchema), async (c) => {
    const userId = c.get('user')!.id;
    const { status } = c.req.valid('query');
    const rows = await db
      .select()
      .from(quests)
      .where(
        status
          ? and(eq(quests.userId, userId), eq(quests.status, status))
          : eq(quests.userId, userId),
      )
      .orderBy(desc(quests.createdAt));
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
      })
      .returning();
    return c.json(created, 201);
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

      return c.json(updated);
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
