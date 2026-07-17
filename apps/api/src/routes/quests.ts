import { Hono } from 'hono';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@soloquest/db/client';
import { quests } from '@soloquest/db/schema';
import {
  XP_REWARDS,
  type Difficulty,
  createQuestSchema,
  updateQuestSchema,
  questIdParamSchema,
  questListQuerySchema,
  completionLogQuerySchema,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import { findOwnedQuest } from '../lib/quests';
import {
  completeQuestCascade,
  countQuestCompletions,
  getCompletionSummary,
  getCompletionLog,
} from '../lib/quest-completions';
import { getUserTimezone } from '../lib/user-settings';
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

  // Chronicles header (UI name): all-time totals + per-rank counts + a 30-day daily-XP
  // timeline, in one round-trip. `totalCompleted` here counts the same log rows as /stats
  // above, so the two views can't drift. Calendar days are computed in the user's timezone.
  .get('/completions/summary', async (c) => {
    const userId = c.get('user')!.id;
    const timezone = await getUserTimezone(db, userId);
    const summary = await getCompletionSummary(db, userId, timezone);
    return c.json(summary);
  })

  // Chronicles log (UI name): the completion history, newest first, keyset-paginated.
  // Each item carries `completedDate` (user-timezone calendar day) so the frontend groups
  // by day without ever touching the raw instant.
  .get('/completions', zValidator('query', completionLogQuerySchema), async (c) => {
    const userId = c.get('user')!.id;
    const { limit, cursor } = c.req.valid('query');
    const timezone = await getUserTimezone(db, userId);
    const page = await getCompletionLog(db, userId, timezone, limit, cursor);
    return c.json(page);
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

  // Complete a quest and grant XP atomically (server-authoritative). Completing a parent
  // cascades into its still-active sub-tasks: each is closed, granted its XP, and logged in
  // the SAME transaction. Before this, a completed parent left its sub-tasks active in the
  // DB but invisible in the UI (they render only nested under a parent that had just left
  // the active list) — orphaned and unreachable. Now they leave as genuinely done.
  .post('/:id/complete', zValidator('param', questIdParamSchema), async (c) => {
    const sessionUser = c.get('user')!;
    const { id } = c.req.valid('param');

    // The whole cascade (parent + active sub-tasks, one transaction) lives in the lib so it
    // can be driven directly by a pglite-backed test; here we just hand it the live client
    // and map its guard outcomes to HTTP.
    const result = await completeQuestCascade(db, sessionUser.id, id);

    if ('error' in result) {
      return result.error === 'not_found'
        ? c.json({ error: 'Quest not found' }, 404)
        : c.json({ error: 'Quest already completed' }, 409);
    }

    return c.json(result);
  });
