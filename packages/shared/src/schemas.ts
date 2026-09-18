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

// Default-free base shared by create and update. No field here carries a Zod `.default()`:
// in Zod 4 `.partial()` keeps an inner default alive (optional → undefined → default), so a
// default on the base would make every PATCH silently write that value (a title-only edit
// resetting difficulty to E was exactly that bug). Defaults that create needs are added
// on `createQuestSchema` via `.extend()`, never here.
const questFields = z.object({
  title: z.string().min(1).max(255),
  // Optional, matching the nullable DB column and recurring quests. Omitted on create →
  // NULL; an empty string is allowed (the edit form sends it to clear).
  description: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_ORDER),
  // Optional, and deliberately WITHOUT a Zod default even on create: omitted → the DB
  // column's NOT NULL DEFAULT 'normal' fills it. Nothing server-side is derived from
  // priority, so (unlike difficulty → xpReward) create doesn't need the value in hand.
  priority: z.enum(QUEST_PRIORITY).optional(),
  deadline: z.coerce.date().nullable().optional(), // null = clear the deadline
  parentId: z.string().uuid().nullable().optional(), // null = promote to top-level quest
  // Full set of tag ids to pin (replace semantics on PATCH). Omitted = leave tags as they
  // are; every id is checked for ownership server-side. Capped so one quest can't hoard tags.
  tagIds: z.array(z.string().uuid()).max(MAX_TAGS_PER_QUEST).optional(),
});

// Create defaults difficulty to E because the route derives xpReward from it at insert time
// (it must know the effective rank; leaving it to the DB default would mean duplicating
// that default in the route). The default lives only on this create schema.
export const createQuestSchema = questFields.extend({
  difficulty: z.enum(DIFFICULTY_ORDER).default("E"),
});

export type CreateQuestInput = z.infer<typeof createQuestSchema>;

// Built from the default-free base, NOT from `createQuestSchema`, so an omitted field stays
// omitted and a PATCH only ever touches what it names.
export const updateQuestSchema = questFields.partial();

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