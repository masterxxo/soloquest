import { eq } from 'drizzle-orm';
import { userSettings } from '@soloquest/db/schema';
import type { DrizzleDB } from './db';
import { DEFAULT_TIMEZONE } from './constants';

/**
 * The user's timezone decides "what day is it for them". Falls back to DEFAULT_TIMEZONE
 * when no settings row exists yet. Shared by the ritual routes and the daily cron so both
 * derive the user's calendar day from exactly one rule.
 */
export async function getUserTimezone(
  database: DrizzleDB,
  userId: string,
): Promise<string> {
  const [settings] = await database
    .select({ timezone: userSettings.timezone })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return settings?.timezone ?? DEFAULT_TIMEZONE;
}
