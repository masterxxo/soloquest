import { eq, sql } from 'drizzle-orm';
import { user as userTable } from '@soloquest/db/schema';
import { levelFromTotalXp } from '@soloquest/shared';
import type { DrizzleDB } from './db';

export interface XpGrant {
  xp: number;
  level: number;
  prevLevel: number;
  leveledUp: boolean;
}

/**
 * Grant XP to a user (server-authoritative) and keep the stored level column
 * consistent with the new total.
 *
 * The XP write is an atomic `xp = xp + amount` evaluated by Postgres, not a
 * read-modify-write in JS, so two completions landing concurrently cannot lose an
 * update. Must run inside a transaction: the first UPDATE row-locks the user for the
 * subsequent level write, and both stay consistent. Level is always derived from the
 * total XP via the shared leveling curve — the single source of truth.
 */
export async function grantXp(
  tx: DrizzleDB,
  userId: string,
  amount: number,
): Promise<XpGrant> {
  const [row] = await tx
    .update(userTable)
    .set({ xp: sql`COALESCE(${userTable.xp}, 0) + ${amount}` })
    .where(eq(userTable.id, userId))
    .returning({ xp: userTable.xp });
  if (!row) throw new Error('Authenticated user not found');

  const newXp = row.xp ?? 0;
  const prevLevel = levelFromTotalXp(newXp - amount).level;
  const { level: newLevel } = levelFromTotalXp(newXp);

  await tx.update(userTable).set({ level: newLevel }).where(eq(userTable.id, userId));

  return { xp: newXp, level: newLevel, prevLevel, leveledUp: newLevel > prevLevel };
}
