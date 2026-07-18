import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '@soloquest/db/client';
import { auth } from './auth';
import { sessionMiddleware, type Variables } from './middleware/auth';
import { questsRouter } from './routes/quests';
import { recurringQuestsRouter } from './routes/recurring-quests';
import { userSettingsRouter } from './routes/user-settings';
import { tagsRouter } from './routes/tags';
import { startDailyCron } from './cron/daily-tick';

const app = new Hono<{ Variables: Variables }>().basePath('/api');

// Every error the API emits has the same body: { error: string }. This catches whatever
// the routes throw instead of handling (a failed insert, a driver error, a bug), which
// would otherwise leave the client with a bare 500 and no parseable body. Deliberate
// failures still return their own status via c.json(..., 4xx) and never reach here.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('[api] unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Better Auth owns /api/auth/* — hand every method off to its fetch handler.
app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));

// Load the session into context for every route registered below.
app.use('*', sessionMiddleware);

app.get('/health', async (c) => {
  await db.execute('select 1');
  return c.json({ ok: true });
});

// Mount via chaining so AppType carries the route types for Hono RPC. Exported because the
// chained value is the only thing carrying those types - AppType below is derived from it.
export const routes = app
  .route('/quests', questsRouter)
  .route('/recurring-quests', recurringQuestsRouter)
  .route('/user', userSettingsRouter)
  .route('/tags', tagsRouter);

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`API → http://localhost:${port}/api/health`);

// Daily streak-reset tick (03:00 UTC). Registered after the server is up.
startDailyCron(db);

export type AppType = typeof routes;
export type Auth = typeof auth;
