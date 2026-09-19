import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '@soloquest/db/client';
import { userSettings } from '@soloquest/db/schema';
import { updateUserSettingsSchema } from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import { zValidator } from '../lib/validate';
import { DEFAULT_TIMEZONE } from '../lib/constants';

// Mounted at /api/user → these become /api/user/settings.
export const userSettingsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // Return the user's settings. A read never creates the row: "no row" is the signal that
  // the user has never chosen a timezone (`isDefault: true`, with the fallback zone), which
  // is what lets the web app auto-detect one on boot without ever overriding a saved choice
  // — including a deliberate 'UTC', which is a row like any other.
  .get('/settings', async (c) => {
    const userId = c.get('user')!.id;

    const [settings] = await db
      .select({ timezone: userSettings.timezone })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    return c.json({ timezone: settings?.timezone ?? DEFAULT_TIMEZONE, isDefault: !settings });
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

    // Same shape as GET — the row now exists, so the zone is a saved choice.
    return c.json({ timezone: settings!.timezone, isDefault: false });
  });
