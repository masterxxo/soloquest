// Canonical enum tuples — the single source of truth shared by Zod (`z.enum`),
// Drizzle (`pgEnum`), the backend and the frontend. Kept deliberately dependency-free
// (no Zod, no leveling math) so `packages/db` can import it without pulling heavy
// runtime code into migrations/tooling.
//
// ⚠️ Order matters: Postgres stores enum members in declaration order. Never reorder
// or remove values without an explicit ALTER TYPE migration.

// Rank ordering from lowest to highest. Index = rank strength.
export const DIFFICULTY_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

// Lifecycle of a one-off quest.
export const QUEST_STATUS = ['active', 'completed', 'failed'] as const;

// How a recurring quest repeats (see recurring.ts / db schema for per-value semantics).
export const RECURRENCE_TYPE = ['daily', 'every_x_days', 'weekdays'] as const;

// Achievement category: streak-based (consecutive days) or total-based (lifetime completions).
export const ACHIEVEMENT_TYPE = ['streak', 'total'] as const;

export type Difficulty = (typeof DIFFICULTY_ORDER)[number];
export type QuestStatus = (typeof QUEST_STATUS)[number];
export type RecurrenceType = (typeof RECURRENCE_TYPE)[number];
export type AchievementType = (typeof ACHIEVEMENT_TYPE)[number];
