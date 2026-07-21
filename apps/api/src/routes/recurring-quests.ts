import { Hono } from 'hono';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@soloquest/db/client';
import {
  recurringQuests,
  recurringQuestCompletions,
  recurringQuestStreaks,
} from '@soloquest/db/schema';
import {
  createRecurringQuestSchema,
  updateRecurringQuestSchema,
  completeRecurringQuestSchema,
  recurringQuestIdParamSchema,
  normalizeRecurrence,
  RecurrenceValidationError,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import {
  getUserDate,
  toDateString,
  wasRequiredOn,
  calendarWindowStart,
  buildRecurringCalendar,
} from '../lib/recurrence';
import { getUserTimezone } from '../lib/user-settings';
import { findOwnedRecurringQuest } from '../lib/recurring-quests';
import { completeRecurringQuestForDate } from '../lib/recurring-completion';
import { zValidator } from '../lib/validate';

// Route-level messages for each refusal the completion helper can return. 4xx bodies keep
// the one-shape { error } contract; not_active / already_completed are 409, the rest 400.
const BACKFILL_ERROR: Record<string, { message: string; status: 400 | 409 }> = {
  not_active: { message: 'Recurring quest is not active', status: 409 },
  out_of_range: { message: "Completion date must be within the ritual's active range", status: 400 },
  out_of_window: { message: 'This day is too far in the past to complete', status: 400 },
  not_required: { message: 'Quest was not required on this date', status: 400 },
  already_completed: { message: 'Already completed for this date', status: 409 },
};

// How many weeks back the /stats heatmap shows. Pulled out as a constant so the window
// can later be bumped to a full year (e.g. 52) in one place.
const CALENDAR_WEEKS = 18;

// Chained so Hono RPC can infer the route types end-to-end.
export const recurringQuestsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // List the user's active recurring quests, each with its streak plus two derived
  // flags for today (in the user's timezone): isDueToday and isCompletedToday.
  .get('/', async (c) => {
    const userId = c.get('user')!.id;
    const timezone = await getUserTimezone(db, userId);
    const today = getUserDate(new Date(), timezone);
    const todayStr = toDateString(today);

    const rows = await db.query.recurringQuests.findMany({
      where: and(eq(recurringQuests.userId, userId), eq(recurringQuests.isActive, true)),
      orderBy: desc(recurringQuests.createdAt),
      with: {
        streak: true,
        // Only today's completion is needed to derive isCompletedToday.
        completions: { where: eq(recurringQuestCompletions.completedDate, todayStr) },
      },
    });

    const result = rows.map(({ completions, ...quest }) => ({
      ...quest,
      isDueToday: wasRequiredOn(quest, today),
      isCompletedToday: completions.length > 0,
    }));

    return c.json(result);
  })

  // Create a recurring quest and its (empty) streak row atomically.
  .post('/', zValidator('json', createRecurringQuestSchema), async (c) => {
    const userId = c.get('user')!.id;
    const input = c.req.valid('json');

    // Single source of truth for the cross-field recurrence rules (also used by PATCH).
    let recurrence;
    try {
      recurrence = normalizeRecurrence(input);
    } catch (err) {
      if (err instanceof RecurrenceValidationError) return c.json({ error: err.message }, 400);
      throw err;
    }

    const result = await db.transaction(async (tx) => {
      const [quest] = await tx
        .insert(recurringQuests)
        .values({
          userId,
          title: input.title,
          description: input.description,
          difficulty: input.difficulty,
          recurrenceType: recurrence.recurrenceType,
          recurrenceValue: recurrence.recurrenceValue,
        })
        .returning();
      if (!quest) throw new Error('Failed to create recurring quest');

      const [streak] = await tx
        .insert(recurringQuestStreaks)
        .values({ recurringQuestId: quest.id, userId })
        .returning();
      if (!streak) throw new Error('Failed to create streak');

      return { quest, streak };
    });

    return c.json(result, 201);
  })

  // Partial edit, scoped to the owner. Only active recurring quests are editable.
  .patch(
    '/:id',
    zValidator('param', recurringQuestIdParamSchema),
    zValidator('json', updateRecurringQuestSchema),
    async (c) => {
      const userId = c.get('user')!.id;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      if (Object.keys(input).length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      const existing = await findOwnedRecurringQuest(db, id, userId);
      if (!existing) return c.json({ error: 'Recurring quest not found' }, 404);
      if (!existing.isActive) {
        return c.json({ error: 'Only active recurring quests can be edited' }, 409);
      }

      // Validate the *effective* recurrence (request merged over the stored row) so a
      // partial PATCH can't leave an inconsistent type/value pair (e.g. switching to
      // every_x_days without an interval). An explicit null is honored; an omitted
      // field falls back to the existing value.
      const effectiveType = input.recurrenceType ?? existing.recurrenceType;
      const effectiveValue =
        input.recurrenceValue !== undefined ? input.recurrenceValue : existing.recurrenceValue;

      let recurrence;
      try {
        recurrence = normalizeRecurrence({
          recurrenceType: effectiveType,
          recurrenceValue: effectiveValue,
        });
      } catch (err) {
        if (err instanceof RecurrenceValidationError) return c.json({ error: err.message }, 400);
        throw err;
      }

      const [updated] = await db
        .update(recurringQuests)
        .set({
          ...input,
          recurrenceType: recurrence.recurrenceType,
          recurrenceValue: recurrence.recurrenceValue,
        })
        .where(and(eq(recurringQuests.id, id), eq(recurringQuests.userId, userId)))
        .returning();
      if (!updated) throw new Error('Failed to update recurring quest');

      return c.json(updated);
    },
  )

  // Soft delete: deactivate so history (completions, streak) survives.
  .delete('/:id', zValidator('param', recurringQuestIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');

    const [updated] = await db
      .update(recurringQuests)
      .set({ isActive: false })
      .where(and(eq(recurringQuests.id, id), eq(recurringQuests.userId, userId)))
      .returning();

    if (!updated) return c.json({ error: 'Recurring quest not found' }, 404);
    return c.json({ success: true });
  })

  // Complete a recurring quest for a given date — today's completion or a backfilled
  // missed day, one path. Records it, recalculates the streak, grants flat XP, and awards
  // any newly-crossed achievements, all atomically. Date validation and the transaction
  // live in completeRecurringQuestForDate; here we only resolve ownership + the timezone
  // and translate its typed refusals into HTTP responses.
  .post(
    '/:id/complete',
    zValidator('param', recurringQuestIdParamSchema),
    zValidator('json', completeRecurringQuestSchema),
    async (c) => {
      const userId = c.get('user')!.id;
      const { id } = c.req.valid('param');
      const { completedDate } = c.req.valid('json');

      const quest = await findOwnedRecurringQuest(db, id, userId);
      if (!quest) return c.json({ error: 'Recurring quest not found' }, 404);

      const timezone = await getUserTimezone(db, userId);
      const today = toDateString(getUserDate(new Date(), timezone));

      const result = await completeRecurringQuestForDate(db, {
        quest,
        userId,
        completedDate,
        today,
        timezone,
      });

      if ('error' in result) {
        const mapped = BACKFILL_ERROR[result.error]!;
        return c.json({ error: mapped.message }, mapped.status);
      }

      return c.json(result);
    },
  )

  // Streak summary, the last 30 completion dates, and a GitHub-style completion
  // calendar (heatmap) — all scoped to the owner.
  .get('/:id/stats', zValidator('param', recurringQuestIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');

    // The full row carries the recurrence config, which feeds the calendar's "due day" logic.
    const quest = await findOwnedRecurringQuest(db, id, userId);
    if (!quest) return c.json({ error: 'Recurring quest not found' }, 404);

    const [streak] = await db
      .select()
      .from(recurringQuestStreaks)
      .where(eq(recurringQuestStreaks.recurringQuestId, id));

    const completions = await db
      .select({ completedDate: recurringQuestCompletions.completedDate })
      .from(recurringQuestCompletions)
      .where(eq(recurringQuestCompletions.recurringQuestId, id))
      .orderBy(desc(recurringQuestCompletions.completedDate))
      .limit(30);

    // Completion calendar (heatmap): day-by-day status in the user's timezone, from the
    // quest's start (or the last CALENDAR_WEEKS weeks) up to today. "Required day" is
    // computed by the same function (wasRequiredOn) as the cron — a single source of truth.
    const timezone = await getUserTimezone(db, userId);
    const today = getUserDate(new Date(), timezone);
    const questStart = getUserDate(quest.createdAt, timezone);
    const windowStart = calendarWindowStart(today, questStart, CALENDAR_WEEKS);

    // Only completions within the window — completedDate is a `date` column, so a
    // lexicographic 'YYYY-MM-DD' comparison is equivalent to comparing the dates.
    const windowCompletions = await db
      .select({ completedDate: recurringQuestCompletions.completedDate })
      .from(recurringQuestCompletions)
      .where(
        and(
          eq(recurringQuestCompletions.recurringQuestId, id),
          gte(recurringQuestCompletions.completedDate, toDateString(windowStart)),
        ),
      );
    const completedDates = new Set(windowCompletions.map((row) => row.completedDate));

    const calendar = buildRecurringCalendar(quest, windowStart, today, completedDates);

    return c.json({
      streak: streak ?? null,
      completions: completions.map((row) => row.completedDate),
      calendar,
    });
  });
