import { z } from "zod";

// Mirrors the DB recurrence_type enum. Exported so the frontend can build its
// recurrence picker from a single source of truth.
export const RECURRENCE_TYPES = ['daily', 'every_x_days', 'weekdays'] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

// Plain object kept separate so updateRecurringQuestSchema can call .partial()
// on it — .partial() is unavailable once a schema is wrapped by .superRefine().
const recurringQuestFields = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  difficulty: z.enum(["E", "D", "C", "B", "A", "S"]).default("E"),
  recurrenceType: z.enum(RECURRENCE_TYPES),
  // Semantics depend on recurrenceType:
  //   daily        → null
  //   every_x_days → interval in days (required)
  //   weekdays     → weekday bitmask (bit 0 = Mon … bit 6 = Sun)
  recurrenceValue: z.number().int().positive().nullable().optional(),
});

// every_x_days is meaningless without an interval — enforce it at the edge.
export const createRecurringQuestSchema = recurringQuestFields.superRefine((data, ctx) => {
  if (
    data.recurrenceType === 'every_x_days' &&
    (data.recurrenceValue === null || data.recurrenceValue === undefined)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ['recurrenceValue'],
      message: 'recurrenceValue is required when recurrenceType is "every_x_days"',
    });
  }
});

export type CreateRecurringQuestInput = z.infer<typeof createRecurringQuestSchema>;

// Partial of the base fields (off the plain object, not the refined schema).
export const updateRecurringQuestSchema = recurringQuestFields.partial();
export type UpdateRecurringQuestInput = z.infer<typeof updateRecurringQuestSchema>;

// The client sends the calendar date in its own timezone, so the server records
// the completion against the user's local day rather than a UTC instant.
export const completeRecurringQuestSchema = z.object({
  completedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'completedDate must be in YYYY-MM-DD format'),
});
export type CompleteRecurringQuestInput = z.infer<typeof completeRecurringQuestSchema>;

export const recurringQuestIdParamSchema = z.object({ id: z.string().uuid() });

// IANA timezone, validated against the runtime's own list (works in Node 20+ and
// modern browsers via Intl.supportedValuesOf).
export const updateUserSettingsSchema = z.object({
  timezone: z.string().refine(
    (tz) => {
      try {
        return Intl.supportedValuesOf('timeZone').includes(tz);
      } catch {
        return false;
      }
    },
    { message: 'Invalid IANA timezone' },
  ),
});
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
