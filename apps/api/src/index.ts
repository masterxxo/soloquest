import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { db }  from '@soloquest/db';
import { auth } from './auth';
import { sessionMiddleware, type Variables } from './middleware/auth';
import { questsRouter } from './routes/quests';

const app = new Hono<{ Variables: Variables }>().basePath('/api');

// Better Auth owns /api/auth/* — hand every method off to its fetch handler.
app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));

// Load the session into context for every route registered below.
app.use('*', sessionMiddleware);

app.get('/health', async (c) => {
  await db.execute('select 1');
  return c.json({ ok: true });
});

// Mount via chaining so AppType carries the quest route types for Hono RPC.
const routes = app.route('/quests', questsRouter);

const port = Number(process.env.port ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`API → http://localhost:${port}/api/health`);

export type AppType = typeof routes;
export type Auth = typeof auth;
