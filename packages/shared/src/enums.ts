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

// Canonical tag-colour palette: 15 keys tuned for the dark ground (#0a0618) and the accent
// (#7c5ce8). The DATABASE stores the KEY, never the hex — so re-tuning a shade or adding a
// theme is a code change, not a data migration. Like every other enum here this feeds a
// Drizzle pgEnum (tag_color), so ⚠️ order is canonical: appending is fine, reordering or
// removing a value is an ALTER TYPE and forbidden. Hex values live only in TAG_COLOR_HEX.
export const TAG_COLORS = [
  'amethyst',
  'iris',
  'lavender',
  'periwinkle',
  'sapphire',
  'cerulean',
  'teal',
  'jade',
  'moss',
  'amber',
  'ember',
  'rust',
  'crimson',
  'magenta',
  'plum',
] as const;

export type Difficulty = (typeof DIFFICULTY_ORDER)[number];
export type QuestStatus = (typeof QUEST_STATUS)[number];
export type RecurrenceType = (typeof RECURRENCE_TYPE)[number];
export type AchievementType = (typeof ACHIEVEMENT_TYPE)[number];
export type TagColor = (typeof TAG_COLORS)[number];

// The single place a colour key becomes a concrete hex. Every layer (chips, swatches,
// filters) reads from here — no hex is written anywhere else in the app.
export const TAG_COLOR_HEX: Record<TagColor, string> = {
  amethyst: '#7c5ce8',
  iris: '#9d7cf0',
  lavender: '#b9a5f5',
  periwinkle: '#7d8cf0',
  sapphire: '#5c7ce8',
  cerulean: '#4a9fd8',
  teal: '#3fa8a0',
  jade: '#4fae7a',
  moss: '#7ba85c',
  amber: '#d9a441',
  ember: '#e08945',
  rust: '#d4664a',
  crimson: '#d4536b',
  magenta: '#c956a8',
  plum: '#a05cc4',
};

// Deterministic default colour for a tag created without one: a stable hash of the
// normalized name → an index into the palette. The same name always yields the same colour
// (so on-the-fly creation is reproducible), while different names spread across the palette
// instead of all landing on one shade. Dependency-free on purpose (this file feeds migrations).
export function tagColorForName(normalizedName: string): TagColor {
  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    // 32-bit FNV-1a-ish rolling hash: stable across runs and platforms.
    hash = (hash * 31 + normalizedName.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length]!;
}
