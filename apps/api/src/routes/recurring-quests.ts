import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gte } from 'drizzle-orm';
import {
  db,
  recurringQuests,
  recurringQuestCompletions,
  recurringQuestStreaks,
  userSettings,
} from '@soloquest/db';
import {
  createRecurringQuestSchema,
  updateRecurringQuestSchema,
  completeRecurringQuestSchema,
  recurringQuestIdParamSchema,
  normalizeRecurrence,
  RecurrenceValidationError,
  RECURRING_XP_REWARD,
} from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import {
  getUserDate,
  toDateString,
  fromDateString,
  wasRequiredOn,
  previousRequiredDate,
  isCompletableDate,
  calendarWindowStart,
  buildRitualCalendar,
} from '../lib/recurrence';
import { checkAndAwardAchievements } from '../lib/streak';
import { grantXp } from '../lib/xp';

// How many weeks back the /stats heatmap shows. Pulled out as a constant so the window
// can later be bumped to a full year (e.g. 52) in one place.
const CALENDAR_WEEKS = 18;

// The user's timezone decides "what day is it for them". Falls back to UTC when no
// settings row exists yet.
async function getUserTimezone(userId: string): Promise<string> {
  const [settings] = await db
    .select({ timezone: userSettings.timezone })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return settings?.timezone ?? 'UTC';
}

// Chained so Hono RPC can infer the route types end-to-end.
export const recurringQuestsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // List the user's active recurring quests, each with its streak plus two derived
  // flags for today (in the user's timezone): isDueToday and isCompletedToday.
  .get('/', async (c) => {
    const userId = c.get('user')!.id;
    const timezone = await getUserTimezone(userId);
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

      const [existing] = await db
        .select()
        .from(recurringQuests)
        .where(and(eq(recurringQuests.id, id), eq(recurringQuests.userId, userId)));

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

  // Complete a recurring quest for a given date: record it, advance the streak, grant
  // XP, and award any newly-crossed achievements — all atomically.
  .post(
    '/:id/complete',
    zValidator('param', recurringQuestIdParamSchema),
    zValidator('json', completeRecurringQuestSchema),
    async (c) => {
      const userId = c.get('user')!.id;
      const { id } = c.req.valid('param');
      const { completedDate } = c.req.valid('json');

      const [quest] = await db
        .select()
        .from(recurringQuests)
        .where(and(eq(recurringQuests.id, id), eq(recurringQuests.userId, userId)));

      if (!quest) return c.json({ error: 'Recurring quest not found' }, 404);
      if (!quest.isActive) {
        return c.json({ error: 'Recurring quest is not active' }, 409);
      }

      // One completion per quest per day.
      const [already] = await db
        .select({ id: recurringQuestCompletions.id })
        .from(recurringQuestCompletions)
        .where(
          and(
            eq(recurringQuestCompletions.recurringQuestId, id),
            eq(recurringQuestCompletions.completedDate, completedDate),
          ),
        );
      if (already) {
        return c.json({ error: 'Already completed for this date' }, 409);
      }

      const completedDateObj = fromDateString(completedDate);

      // Reject future dates and anything before the ritual existed — otherwise a client
      // could farm XP, totalCompletions, streaks and achievements with fabricated dates.
      const timezone = await getUserTimezone(userId);
      // Anchor both bounds through getUserDate so today and createdDate share one frame
      // (the user's local calendar day) — no UTC/local mixing on the day boundary.
      const today = toDateString(getUserDate(new Date(), timezone));
      const createdDate = toDateString(getUserDate(quest.createdAt, timezone));
      if (!isCompletableDate(completedDate, today, createdDate)) {
        return c.json(
          { error: "Completion date must be within the ritual's active range" },
          400,
        );
      }

      if (!wasRequiredOn(quest, completedDateObj)) {
        return c.json({ error: 'Quest was not required on this date' }, 400);
      }

      const result = await db.transaction(async (tx) => {
        const [completion] = await tx
          .insert(recurringQuestCompletions)
          .values({ recurringQuestId: id, userId, completedDate })
          .returning();
        if (!completion) throw new Error('Failed to record completion');

        // Read the current streak (created at POST; recreated defensively if missing).
        let [streak] = await tx
          .select()
          .from(recurringQuestStreaks)
          .where(eq(recurringQuestStreaks.recurringQuestId, id));
        if (!streak) {
          [streak] = await tx
            .insert(recurringQuestStreaks)
            .values({ recurringQuestId: id, userId })
            .returning();
        }
        if (!streak) throw new Error('Failed to load or create streak');

        // The streak continues only if the previous completion landed exactly on the
        // prior required day; otherwise it restarts at 1.
        const prevRequired = previousRequiredDate(quest, completedDateObj);
        const prevRequiredStr = prevRequired ? toDateString(prevRequired) : null;
        const continues =
          streak.lastCompletedDate !== null &&
          prevRequiredStr !== null &&
          streak.lastCompletedDate === prevRequiredStr;

        const currentStreak = continues ? streak.currentStreak + 1 : 1;
        const longestStreak = Math.max(streak.longestStreak, currentStreak);
        const totalCompletions = streak.totalCompletions + 1;
        // Never move lastCompletedDate backwards (e.g. backfilling an earlier date).
        const lastCompletedDate =
          streak.lastCompletedDate && streak.lastCompletedDate > completedDate
            ? streak.lastCompletedDate
            : completedDate;

        const [updatedStreak] = await tx
          .update(recurringQuestStreaks)
          .set({ currentStreak, longestStreak, totalCompletions, lastCompletedDate })
          .where(eq(recurringQuestStreaks.recurringQuestId, id))
          .returning();
        if (!updatedStreak) throw new Error('Failed to update streak');

        // Server-authoritative XP: flat reward via the shared atomic helper.
        const player = await grantXp(tx, userId, RECURRING_XP_REWARD);

        const { newAchievements } = await checkAndAwardAchievements(
          tx,
          userId,
          id,
          updatedStreak,
        );

        return {
          completion,
          streak: {
            currentStreak: updatedStreak.currentStreak,
            longestStreak: updatedStreak.longestStreak,
            totalCompletions: updatedStreak.totalCompletions,
          },
          player: { xp: player.xp, level: player.level },
          leveledUp: player.leveledUp,
          newAchievements,
        };
      });

      return c.json(result);
    },
  )

  // Streak summary, the last 30 completion dates, and a GitHub-style completion
  // calendar (heatmap) — all scoped to the owner.
  .get('/:id/stats', zValidator('param', recurringQuestIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');

    // Pull the recurrence config too — it feeds the calendar's "due day" logic.
    const [quest] = await db
      .select({
        id: recurringQuests.id,
        recurrenceType: recurringQuests.recurrenceType,
        recurrenceValue: recurringQuests.recurrenceValue,
        createdAt: recurringQuests.createdAt,
      })
      .from(recurringQuests)
      .where(and(eq(recurringQuests.id, id), eq(recurringQuests.userId, userId)));
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
    // ritual's start (or the last CALENDAR_WEEKS weeks) up to today. "Required day" is
    // computed by the same function (wasRequiredOn) as the cron — a single source of truth.
    const timezone = await getUserTimezone(userId);
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

    const calendar = buildRitualCalendar(quest, windowStart, today, completedDates);

    return c.json({
      streak: streak ?? null,
      completions: completions.map((row) => row.completedDate),
      calendar,
    });
  });
