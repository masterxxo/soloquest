import { hc } from 'hono/client';
import type { InferResponseType } from 'hono/client';
import type { AppType } from '@soloquest/api';

// Client-side RPC client. baseURL = current origin so /api/* stays same-origin through
// the dev proxy (the session cookie rides along automatically — no CORS, no credentials
// config). The '' fallback only avoids touching `window` if the module is evaluated
// during SSR; every quest call runs client-side.
export const client = hc<AppType>(import.meta.client ? window.location.origin : '');

// Types inferred straight from the API routes (dates arrive JSON-serialized as strings).
// subTasks is attached only when a request passes include=subTasks, so it's an optional,
// self-referential field layered on top of the inferred row shape.
export type Quest = InferResponseType<typeof client.api.quests.$get>[number] & {
  subTasks?: Quest[];
};

// POST /api/quests and PATCH /api/quests/:id now return the quest plus non-blocking
// rank warnings instead of a bare Quest.
export type QuestWithWarnings = { quest: Quest; warnings: string[] };

export type CompleteResult = InferResponseType<
  (typeof client.api.quests)[':id']['complete']['$post'],
  200
>;

// ── Recurring quests ────────────────────────────────────────────────────────
// A recurring quest's stored row on its own, as returned bare by PATCH
// /api/recurring-quests/:id (and nested as `quest` in the create response). Used for
// the create/update emit payloads, which never carry streak/today data.
export type RecurringQuest = InferResponseType<
  (typeof client.api['recurring-quests'])[':id']['$patch'],
  200
>;

// The list shape from GET /api/recurring-quests: every stored field plus the streak
// relation and the two per-day flags the backend derives in the user's timezone.
// Inferred 1:1 from the route, so `streak` is the full streak row (nullable relation),
// not a hand-narrowed subset.
export type RecurringQuestWithStreak = InferResponseType<
  typeof client.api['recurring-quests']['$get']
>[number];

// POST /api/recurring-quests/:id/complete: completion row + the three streak counters
// + new player xp/level + leveledUp + any achievements just crossed.
export type RecurringCompleteResult = InferResponseType<
  (typeof client.api['recurring-quests'])[':id']['complete']['$post'],
  200
>;

// A single achievement record, taken straight from the /complete payload so it stays in
// step with what the backend awards (id, type, threshold, xpBonus, title, description).
export type Achievement = RecurringCompleteResult['newAchievements'][number];

// GET /api/recurring-quests/:id/stats → streak summary, recent completion dates, and
// the completion calendar (heatmap). Inferred 1:1 from the route so the calendar's
// day/status shape stays in step with the backend.
export type RecurringQuestStats = InferResponseType<
  (typeof client.api['recurring-quests'])[':id']['stats']['$get'],
  200
>;

// One calendar cell: { date: 'YYYY-MM-DD', status: 'done' | 'missed' | 'not_scheduled' }.
export type RitualCalendarDay = RecurringQuestStats['calendar'][number];

// GET /api/user/settings → the user's settings row (currently just timezone + stamps).
export type UserSettings = InferResponseType<typeof client.api.user.settings.$get, 200>;
