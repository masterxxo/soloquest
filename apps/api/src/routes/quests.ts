import { Hono } from 'hono';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { db } from '@soloquest/db/client';
import { quests } from '@soloquest/db/schema';
import {
  XP_REWARDS,
  type Difficulty,
  type TagColor,
  createQuestSchema,
  updateQuestSchema,
  questIdParamSchema,
  questListQuerySchema,
  completionLogQuerySchema,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import { findOwnedQuest, type Quest } from '../lib/quests';
import { assertOwnedTags, replaceQuestTags, getQuestTags } from '../lib/tags';
import {
  completeQuestCascade,
  countQuestCompletions,
  getCompletionSummary,
  getCompletionLog,
} from '../lib/quest-completions';
import { getUserTimezone } from '../lib/user-settings';
import { getUserDate, toDateString } from '../lib/recurrence';
import { MS_PER_DAY } from '../lib/constants';
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

// A quest row as returned by the relational list query, carrying its tag pins (and, when
// include=subTasks, its sub-tasks each with their own pins). The `with` config below always
// requests questTags, so this cast just names the shape the query already produces.
type QuestTagJoin = { tag: { id: string; name: string; color: TagColor } };
type QuestRowWithTags = Quest & {
  questTags: QuestTagJoin[];
  subTasks?: Array<Quest & { questTags: QuestTagJoin[] }>;
};

// Flatten each quest's `questTags` join rows into a plain `tags: [{ id, name }]` array (and
// do the same one level down for sub-tasks). Keeps the join table out of the wire shape.
function shapeQuestRow(row: QuestRowWithTags) {
  const { questTags, subTasks, ...quest } = row;
  return {
    ...quest,
    tags: questTags.map((qt) => qt.tag),
    ...(subTasks
      ? {
          subTasks: subTasks.map(({ questTags: subPins, ...sub }) => ({
            ...sub,
            tags: subPins.map((qt) => qt.tag),
          })),
        }
      : {}),
  };
}

// The board's "DONE TODAY" strip: the current user's TOP-LEVEL quests completed *today* in
// their own timezone, each with tags and sub-tasks, most-recent first. Top-level only, so a
// sub-task completed on its own stays nested under its still-active parent — never a stray
// row here (mirrors the list's top-level grouping). A coarse 2-day instant bound keeps the
// scan off the whole completion history; the exact local calendar day is then applied
// per-row, since a raw timestamp range can't name a tz-local day without the offset.
async function loadDoneToday(userId: string) {
  const timezone = await getUserTimezone(db, userId);
  const now = new Date();
  const todayStr = toDateString(getUserDate(now, timezone));
  const since = new Date(now.getTime() - 2 * MS_PER_DAY);
  const rows = (await db.query.quests.findMany({
    where: and(
      eq(quests.userId, userId),
      isNull(quests.parentId),
      eq(quests.status, 'completed'),
      gte(quests.completedAt, since),
    ),
    orderBy: desc(quests.completedAt),
    with: {
      questTags: { with: { tag: { columns: { id: true, name: true, color: true } } } },
      subTasks: {
        with: { questTags: { with: { tag: { columns: { id: true, name: true, color: true } } } } },
      },
    },
  })) as unknown as QuestRowWithTags[];
  return rows
    .filter((r) => r.completedAt && toDateString(getUserDate(r.completedAt, timezone)) === todayStr)
    .map(shapeQuestRow);
}

// Chained so Hono RPC can infer the route types end-to-end.
export const questsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // List the current user's quests. Optional filters: status, parentId
  // ("null" → top-level only, a uuid → that quest's sub-tasks). include=subTasks
  // nests each quest's sub-tasks under it.
  .get('/', zValidator('query', questListQuerySchema), async (c) => {
    const userId = c.get('user')!.id;
    const { status, parentId, include, includeDoneToday } = c.req.valid('query');

    const conditions = [eq(quests.userId, userId)];
    if (status) conditions.push(eq(quests.status, status));
    if (parentId === 'null') conditions.push(isNull(quests.parentId));
    else if (parentId) conditions.push(eq(quests.parentId, parentId));

    // Tags come through a batched relational query (questTags → tag), never per-quest — no
    // N+1: one round-trip fetches every row's pins (and sub-tasks' pins) at once.
    const rows = (await db.query.quests.findMany({
      where: and(...conditions),
      orderBy: desc(quests.createdAt),
      with: {
        questTags: { with: { tag: { columns: { id: true, name: true, color: true } } } },
        ...(include === 'subTasks'
          ? {
              subTasks: {
                with: { questTags: { with: { tag: { columns: { id: true, name: true, color: true } } } } },
              },
            }
          : {}),
      },
    })) as unknown as QuestRowWithTags[];

    const shaped = rows.map(shapeQuestRow);
    // Opt-in: the board asks for the day's completed top-level quests in the same round-trip.
    // They ride along in the same array (status 'completed'); the client splits them out.
    if (includeDoneToday) shaped.push(...(await loadDoneToday(userId)));
    return c.json(shaped);
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

  // A single quest by id, scoped to the owner, with tags and sub-tasks — same shape as a list
  // row. Read-only and status-agnostic (returns completed quests too), so the Chronicles
  // preview can fetch the still-living entity behind a completion-log snapshot. 404 → the quest
  // is gone (or never the caller's), the caller's cue to fall back to the snapshot. Registered
  // after the static GETs (/stats, /completions*) so those win the match, never this param.
  .get('/:id', zValidator('param', questIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');
    const row = (await db.query.quests.findFirst({
      where: and(eq(quests.id, id), eq(quests.userId, userId)),
      with: {
        questTags: { with: { tag: { columns: { id: true, name: true, color: true } } } },
        subTasks: {
          with: { questTags: { with: { tag: { columns: { id: true, name: true, color: true } } } } },
        },
      },
    })) as unknown as QuestRowWithTags | undefined;
    if (!row) return c.json({ error: 'Quest not found' }, 404);
    return c.json(shapeQuestRow(row));
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

    // Reject foreign tags up front, before creating anything — a bad tagId must never leave a
    // quest half-created (its own guard, so ownership isn't trusted from the client).
    if (input.tagIds && !(await assertOwnedTags(db, userId, input.tagIds))) {
      return c.json({ error: 'One or more tags not found' }, 400);
    }

    // Quest row and its tag pins land in one transaction, so a quest never exists tagless
    // after a partial failure.
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(quests)
        .values({
          userId,
          title: input.title,
          description: input.description,
          difficulty: input.difficulty,
          priority: input.priority,
          xpReward: XP_REWARDS[input.difficulty],
          deadline: input.deadline,
          parentId: input.parentId,
        })
        .returning();
      if (!row) throw new Error('Failed to create quest');
      if (input.tagIds?.length) await replaceQuestTags(tx, row.id, input.tagIds);
      return row;
    });

    const tags = await getQuestTags(db, created.id);
    const warnings = await buildRankWarnings(
      userId,
      input.difficulty,
      input.parentId,
    );
    return c.json({ quest: { ...created, tags }, warnings }, 201);
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

      // tagIds is not a column — split it out so it never reaches `.set()`, and validate
      // ownership before touching the DB. `undefined` = leave tags untouched; a present array
      // (even empty) = replace with exactly that set.
      const { tagIds, ...questFields } = input;
      if (tagIds !== undefined && !(await assertOwnedTags(db, userId, tagIds))) {
        return c.json({ error: 'One or more tags not found' }, 400);
      }
      const hasFieldChanges = Object.keys(questFields).length > 0;

      const updated = await db.transaction(async (tx) => {
        let row: Quest = existing;
        if (hasFieldChanges) {
          const [r] = await tx
            .update(quests)
            .set({
              ...questFields,
              // Keep xpReward authoritative when the difficulty changes.
              ...(questFields.difficulty ? { xpReward: XP_REWARDS[questFields.difficulty] } : {}),
            })
            .where(and(eq(quests.id, id), eq(quests.userId, userId)))
            .returning();
          if (!r) throw new Error('Failed to update quest');
          row = r;
        }
        // Replace (not append): drop the old pins and set exactly what was sent.
        if (tagIds !== undefined) await replaceQuestTags(tx, id, tagIds);
        return row;
      });

      const tags = await getQuestTags(db, id);
      // Warn against the *effective* quest after this PATCH — both the difficulty and the
      // parent it ends up with. A PATCH that only raises the difficulty of an existing
      // sub-task must still warn, so an omitted parentId falls back to the stored one.
      const warnings = await buildRankWarnings(
        userId,
        input.difficulty ?? existing.difficulty,
        effectiveParentId(input.parentId, existing.parentId),
      );
      return c.json({ quest: { ...updated, tags }, warnings });
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
