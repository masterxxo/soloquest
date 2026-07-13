import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '@soloquest/db/client';
import { userSettings } from '@soloquest/db/schema';
import { updateUserSettingsSchema } from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import { zValidator } from '../lib/validate';

// Mounted at /api/user → these become /api/user/settings.
export const userSettingsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // Return the user's settings, lazily creating a default (UTC) row on first read.
  .get('/settings', async (c) => {
    const userId = c.get('user')!.id;

    let [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (!settings) {
      [settings] = await db
        .insert(userSettings)
        .values({ userId })
        .onConflictDoNothing()
        .returning();
      // Lost the race to create it — read the row the other request inserted.
      if (!settings) {
        [settings] = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId));
      }
    }

    return c.json(settings);
  })

  // Upsert the user's timezone (validated as a real IANA zone by the schema).
  .patch('/settings', zValidator('json', updateUserSettingsSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { timezone } = c.req.valid('json');

    const [settings] = await db
      .insert(userSettings)
      .values({ userId, timezone })
      .onConflictDoUpdate({
        target: userSettings.userId,
        // $onUpdate doesn't fire on conflict-update, so bump updatedAt explicitly.
        set: { timezone, updatedAt: new Date() },
      })
      .returning();

    return c.json(settings);
  });
