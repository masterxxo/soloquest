import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { db }  from '@soloquest/db';

const app = new Hono().basePath('/api');

app.get('/health', async (c) => {
  await db.execute('select 1');
  return c.json({ ok: true });
});

const port = Number(process.env.port ?? 3001);
serve({ fetch: app.fetch, port });
console.log('API → http://localhost:${port}/api/health');

export type AppType = typeof app;
