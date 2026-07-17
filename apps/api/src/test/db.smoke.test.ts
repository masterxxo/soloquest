import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { quests, user } from '@soloquest/db/schema';
import { createTestDb, type TestDb } from './db';

// Phase-1 gate: proves the pglite harness migrates and round-trips real rows before any
// cascade test leans on it. If this fails, the problem is the harness, not the logic.
describe('pglite test harness', () => {
  let test: TestDb;

  beforeEach(async () => {
    test = await createTestDb();
  });
  afterEach(async () => {
    await test.close();
  });

  it('migrates the schema and round-trips a user + quest', async () => {
    await test.db
      .insert(user)
      .values({ id: 'u1', name: 'Hunter', email: 'hunter@example.com' });
    const [q] = await test.db
      .insert(quests)
      .values({ userId: 'u1', title: 'Clear the dungeon', difficulty: 'A', xpReward: 250 })
      .returning();

    expect(q).toBeDefined();
    // Schema defaults applied by the migrated DB, not by us.
    expect(q!.status).toBe('active');

    const [player] = await test.db.select().from(user).where(eq(user.id, 'u1'));
    expect(player).toMatchObject({ name: 'Hunter', xp: 0, level: 1 });
  });
});
