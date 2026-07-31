import { z } from "zod";
import { DIFFICULTY_ORDER, QUEST_STATUS, QUEST_PRIORITY, TAG_COLORS } from "./enums";

// Tag name limits and the per-quest tag cap — enforced by the backend, mirrored in the UI.
export const TAG_NAME_MAX_LENGTH = 32;
export const MAX_TAGS_PER_QUEST = 10;

// Single source of truth for tag normalization: trim + lowercase. Used for the DB's
// (userId, normalizedName) uniqueness and for every case-insensitive comparison, so
// `Dom` / `dom` / ` DOM ` all resolve to one tag. `name` keeps the original spelling.
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export const createQuestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  difficulty: z.enum(DIFFICULTY_ORDER).default("E"),
  // Optional, and deliberately WITHOUT a Zod default (unlike difficulty): omitted on create →
  // the DB column's NOT NULL DEFAULT 'normal' fills it. A schema `.default()` here would leak
  // through `updateQuestSchema`'s `.partial()` and make every PATCH (e.g. a title-only edit)
  // silently reset priority to 'normal'. Following the `tagIds` optional pattern keeps a PATCH
  // that omits priority a genuine no-op on it, and a present value is written as sent.
  priority: z.enum(QUEST_PRIORITY).optional(),
  deadline: z.coerce.date().nullable().optional(), // null = clear the deadline
  parentId: z.string().uuid().nullable().optional(), // null = promote to top-level quest
  // Full set of tag ids to pin (replace semantics on PATCH). Omitted = leave tags as they
  // are; every id is checked for ownership server-side. Capped so one quest can't hoard tags.
  tagIds: z.array(z.string().uuid()).max(MAX_TAGS_PER_QUEST).optional(),
});

export type CreateQuestInput = z.infer<typeof createQuestSchema>;

export const updateQuestSchema = createQuestSchema.partial();

export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;

export const questIdParamSchema = z.object({ id: z.string().uuid() });

export const questListQuerySchema = z.object({
  status: z.enum(QUEST_STATUS).optional(),
  // Filter by parent: a uuid returns that quest's sub-tasks; "null" returns only
  // top-level quests (those with no parent).
  parentId: z.union([z.string().uuid(), z.literal("null")]).optional(),
  // include=subTasks attaches each quest's sub-tasks to the response rows.
  include: z.literal("subTasks").optional(),
  // includeDoneToday=true also appends the day's completed TOP-LEVEL quests (the board's
  // "DONE TODAY" strip), computed in the user's timezone, alongside the active rows in the
  // same array. They carry status 'completed', so the client splits them out. Omitted → the
  // response is unchanged (active rows only), so existing callers are unaffected.
  includeDoneToday: z.literal("true").optional(),
});

// Tag create. `name` is trimmed by Zod (so " Dom " → "Dom") and must be non-empty after
// trimming — a whitespace-only name is rejected; normalization to `normalizedName` happens
// server-side. `color` is optional (omit → the server derives a deterministic one from the
// name) and must be a palette key when present.
export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH),
  color: z.enum(TAG_COLORS).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

// Update accepts a rename, a recolour, or both — every field optional. The route rejects an
// all-empty body; a colour outside the palette is rejected here at the validation layer.
export const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH).optional(),
  color: z.enum(TAG_COLORS).optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const tagIdParamSchema = z.object({ id: z.string().uuid() });

// Query for the paginated quest-completion log (GET /api/quests/completions). Keyset
// pagination: `cursor` is an opaque token encoding the last row's (completedAt, id), not
// an offset. `limit` is clamped so a single page stays bounded.
export const completionLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});