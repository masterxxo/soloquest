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

// Campaign list element (carries questCount) vs. the single campaign detail object
// (carries its quests, each with nested subTasks). Inferred from the campaign routes.
export type Campaign = InferResponseType<typeof client.api.campaigns.$get>[number];
export type CampaignDetail = InferResponseType<
  (typeof client.api.campaigns)[':id']['$get'],
  200
>;
