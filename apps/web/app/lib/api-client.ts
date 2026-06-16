import { hc } from 'hono/client';
import type { InferResponseType } from 'hono/client';
import type { AppType } from '@soloquest/api';

// Client-side RPC client. baseURL = current origin so /api/* stays same-origin through
// the dev proxy (the session cookie rides along automatically — no CORS, no credentials
// config). The '' fallback only avoids touching `window` if the module is evaluated
// during SSR; every quest call runs client-side.
export const client = hc<AppType>(import.meta.client ? window.location.origin : '');

// Types inferred straight from the API routes (dates arrive JSON-serialized as strings).
export type Quest = InferResponseType<typeof client.api.quests.$get>[number];
export type CompleteResult = InferResponseType<
  (typeof client.api.quests)[':id']['complete']['$post'],
  200
>;
