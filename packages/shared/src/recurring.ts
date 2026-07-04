import { z } from "zod";
import { DIFFICULTY_ORDER, RECURRENCE_TYPE, type RecurrenceType } from "./enums";

// Re-exported for backwards compatibility; the canonical tuple + type now live in
// ./enums (the single source of truth shared with pgEnum).
export type { RecurrenceType };

// Highest valid weekday bitmask: bits 0..6 (Mon..Sun) all set.
const MAX_WEEKDAY_MASK = 0b1111111;

// Thrown by normalizeRecurrence for an invalid recurrenceType/recurrenceValue
// combination. Routes catch this to return a 400 instead of a generic 500.
export class RecurrenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecurrenceValidationError';
  }
}

/**
 * Validate and normalize a recurrence config — the single source of truth for the
 * cross-field rules, shared by both create and update so they can't drift:
 *   daily        → recurrenceValue is forced to null (carries no interval/bitmask)
 *   every_x_days → requires a positive integer interval
 *   weekdays     → requires a weekday bitmask in 1..127 (bit 0 = Mon … bit 6 = Sun)
 *
 * Throws RecurrenceValidationError on an invalid combination. On success returns the
 * value to persist. This lives here (not just in the Zod schema) because the update
 * path validates the *effective* config — request fields merged over the stored row —
 * which a stateless schema refinement cannot see.
 */
export function normalizeRecurrence(config: {
  recurrenceType: RecurrenceType;
  recurrenceValue?: number | null;
}): { recurrenceType: RecurrenceType; recurrenceValue: number | null } {
  const { recurrenceType } = config;
  const value = config.recurrenceValue ?? null;

  switch (recurrenceType) {
    case 'daily':
      return { recurrenceType, recurrenceValue: null };

    case 'every_x_days':
      if (value === null || !Number.isInteger(value) || value < 1) {
        throw new RecurrenceValidationError(
          'recurrenceValue must be a positive integer when recurrenceType is "every_x_days"',
        );
      }
      return { recurrenceType, recurrenceValue: value };

    case 'weekdays':
      if (value === null || !Number.isInteger(value) || value < 1 || value > MAX_WEEKDAY_MASK) {
        throw new RecurrenceValidationError(
          'recurrenceValue must be a weekday bitmask (1..127) when recurrenceType is "weekdays"',
        );
      }
      return { recurrenceType, recurrenceValue: value };

    default:
      throw new RecurrenceValidationError(`Unknown recurrenceType: ${String(recurrenceType)}`);
  }
}

// Plain object kept separate so updateRecurringQuestSchema can call .partial()
// on it — .partial() is unavailable once a schema is wrapped by .superRefine().
const recurringQuestFields = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_ORDER).default("E"),
  recurrenceType: z.enum(RECURRENCE_TYPE),
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
