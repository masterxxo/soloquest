import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, count, getTableColumns, isNull } from 'drizzle-orm';
import { db, campaigns, quests } from '@soloquest/db';
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignIdParamSchema,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';

// Chained so Hono RPC can infer the route types end-to-end.
export const campaignsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // List the current user's campaigns, each with a count of its quests.
  .get('/', async (c) => {
    const userId = c.get('user')!.id;
    const rows = await db
      .select({ ...getTableColumns(campaigns), questCount: count(quests.id) })
      .from(campaigns)
      .leftJoin(quests, eq(quests.campaignId, campaigns.id))
      .where(eq(campaigns.userId, userId))
      .groupBy(campaigns.id)
      .orderBy(desc(campaigns.createdAt));
    return c.json(rows);
  })

  // Create a campaign, scoped to the owner. status defaults to 'active'.
  .post('/', zValidator('json', createCampaignSchema), async (c) => {
    const userId = c.get('user')!.id;
    const input = c.req.valid('json');
    const [created] = await db
      .insert(campaigns)
      .values({
        userId,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        deadline: input.deadline,
      })
      .returning();
    return c.json(created, 201);
  })

  // Campaign details plus its top-level quests, each with its nested sub-tasks.
  .get('/:id', zValidator('param', campaignIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.userId, userId)),
      with: {
        quests: {
          // Only top-level quests here; sub-tasks are nested under their parent.
          where: isNull(quests.parentId),
          with: { subTasks: true },
          orderBy: desc(quests.createdAt),
        },
      },
    });

    if (!campaign) return c.json({ error: 'Campaign not found' }, 404);
    return c.json(campaign);
  })

  // Partial edit, scoped to the owner. Only active campaigns are editable.
  .patch(
    '/:id',
    zValidator('param', campaignIdParamSchema),
    zValidator('json', updateCampaignSchema),
    async (c) => {
      const userId = c.get('user')!.id;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      if (Object.keys(input).length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      const [existing] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));

      if (!existing) return c.json({ error: 'Campaign not found' }, 404);
      // Active and clearing campaigns are still editable; completed ones are locked.
      if (existing.status === 'completed') {
        return c.json({ error: 'Completed campaigns cannot be edited' }, 409);
      }

      const [updated] = await db
        .update(campaigns)
        .set(input)
        .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
        .returning();

      return c.json(updated);
    },
  )

  // Delete, scoped to the owner. Quests are detached (campaign_id → null) by the FK.
  .delete('/:id', zValidator('param', campaignIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');
    const [deleted] = await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
      .returning();

    if (!deleted) return c.json({ error: 'Campaign not found' }, 404);
    return c.json({ success: true });
  })

  // Begin work on a campaign: active → clearing. Idempotent-ish — only an untouched
  // (active) campaign can be started; clearing/completed return 409.
  .post('/:id/start', zValidator('param', campaignIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));

    if (!existing) return c.json({ error: 'Campaign not found' }, 404);
    if (existing.status !== 'active') {
      return c.json({ error: 'Campaign already started' }, 409);
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: 'clearing' })
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
      .returning();

    return c.json(updated);
  })

  // Mark a campaign as completed, scoped to the owner.
  .post('/:id/complete', zValidator('param', campaignIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));

    if (!existing) return c.json({ error: 'Campaign not found' }, 404);
    if (existing.status === 'completed') {
      return c.json({ error: 'Campaign already completed' }, 409);
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
      .returning();

    return c.json(updated);
  });
