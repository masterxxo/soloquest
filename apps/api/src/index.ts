import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { db }  from '@soloquest/db';
import { auth } from './auth';

const app = new Hono().basePath('/api');

// Better Auth owns /api/auth/* — hand every method off to its fetch handler.
app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));

app.get('/health', async (c) => {
  await db.execute('select 1');
  return c.json({ ok: true });
});

const port = Number(process.env.port ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`API → http://localhost:${port}/api/health`);

export type AppType = typeof app;
export type Auth = typeof auth;
