import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { quests, questCompletions, user } from '@soloquest/db/schema';
import { XP_REWARDS, type Difficulty } from '@soloquest/shared';
import { createTestDb, type TestDb } from '../test/db';
import { completeQuestCascade } from './quest-completions';
import type { DrizzleDB } from './db';

// Cascade completion, exercised on a real (pglite) database and the real transaction —
// nothing about `db`, `grantXp` or the completion writes is mocked. Every case asserts
// three things at once: (a) quest statuses, (b) the player's XP/level, (c) the number and
// content of quest_completions rows. A status-only test would wave zero-duplicate XP through.

const INT4_MAX = 2147483647;

async function seedUser(db: DrizzleDB, id: string, xp = 0): Promise<void> {
  await db.insert(user).values({ id, name: `Hunter ${id}`, email: `${id}@example.com`, xp });
}

interface SeedQuest {
  userId: string;
  difficulty: Difficulty;
  title: string;
  parentId?: string | null;
  status?: 'active' | 'completed' | 'failed';
}

async function seedQuest(db: DrizzleDB, opts: SeedQuest) {
  const [q] = await db
    .insert(quests)
    .values({
      userId: opts.userId,
      parentId: opts.parentId ?? null,
      title: opts.title,
      difficulty: opts.difficulty,
      xpReward: XP_REWARDS[opts.difficulty],
      status: opts.status ?? 'active',
    })
    .returning();
  return q!;
}

async function getQuest(db: DrizzleDB, id: string) {
  const [q] = await db.select().from(quests).where(eq(quests.id, id));
  return q!;
}
async function getPlayer(db: DrizzleDB, id: string) {
  const [u] = await db.select().from(user).where(eq(user.id, id));
  return u!;
}
async function getCompletions(db: DrizzleDB, userId: string) {
  return db.select().from(questCompletions).where(eq(questCompletions.userId, userId));
}

// completeQuestCascade returns a union; every success case here narrows past the guard.
function expectSuccess<T extends { error: string } | object>(
  result: T,
): Exclude<T, { error: string }> {
  if ('error' in result) throw new Error(`expected success, got ${result.error}`);
  return result as Exclude<T, { error: string }>;
}

describe('completeQuestCascade', () => {
  const USER = 'user-a';
  let test: TestDb;
  let db: DrizzleDB;

  beforeEach(async () => {
    test = await createTestDb();
    db = test.db;
  });
  afterEach(async () => {
    await test.close();
  });

  it('1. happy path: closes the parent and all active sub-tasks, once each', async () => {
    await seedUser(db, USER);
    const parent = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'Raid' }); // 10
    const c1 = await seedQuest(db, { userId: USER, difficulty: 'D', title: 'Scout', parentId: parent.id }); // 25
    const c2 = await seedQuest(db, { userId: USER, difficulty: 'C', title: 'Breach', parentId: parent.id }); // 50
    const c3 = await seedQuest(db, { userId: USER, difficulty: 'B', title: 'Boss', parentId: parent.id }); // 100

    const result = expectSuccess(await completeQuestCascade(db, USER, parent.id));

    // (a) statuses: all four completed.
    for (const id of [parent.id, c1.id, c2.id, c3.id]) {
      expect((await getQuest(db, id)).status).toBe('completed');
    }
    expect(result.cascadedCompletions).toBe(3);

    // (b) player: XP is the sum of all four rewards; level derived from it (185 → level 2).
    const player = await getPlayer(db, USER);
    expect(player.xp).toBe(10 + 25 + 50 + 100);
    expect(player.level).toBe(2);
    expect(result.player).toEqual({ xp: 185, level: 2 });
    expect(result.leveledUp).toBe(true);

    // (c) log: exactly four rows, each snapshotting its own quest's title/difficulty/XP.
    const completions = await getCompletions(db, USER);
    expect(completions).toHaveLength(4);
    const byQuest = new Map(completions.map((r) => [r.questId, r]));
    expect(byQuest.get(parent.id)).toMatchObject({ title: 'Raid', difficulty: 'E', xpAwarded: 10 });
    expect(byQuest.get(c1.id)).toMatchObject({ title: 'Scout', difficulty: 'D', xpAwarded: 25 });
    expect(byQuest.get(c2.id)).toMatchObject({ title: 'Breach', difficulty: 'C', xpAwarded: 50 });
    expect(byQuest.get(c3.id)).toMatchObject({ title: 'Boss', difficulty: 'B', xpAwarded: 100 });
    // One shared instant for the whole cascade.
    const instants = new Set(completions.map((r) => r.completedAt.getTime()));
    expect(instants.size).toBe(1);
  });

  it('2. idempotent partial cascade: skips an already-completed sub-task', async () => {
    await seedUser(db, USER);
    const parent = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'Raid' }); // 10
    const done = await seedQuest(db, { userId: USER, difficulty: 'C', title: 'Done', parentId: parent.id, status: 'completed' }); // 50, already closed
    const a1 = await seedQuest(db, { userId: USER, difficulty: 'D', title: 'A1', parentId: parent.id }); // 25
    const a2 = await seedQuest(db, { userId: USER, difficulty: 'B', title: 'A2', parentId: parent.id }); // 100

    const result = expectSuccess(await completeQuestCascade(db, USER, parent.id));

    // (a) statuses: all completed, but only 2 were closed by this call.
    expect(result.cascadedCompletions).toBe(2);
    expect((await getQuest(db, done.id)).status).toBe('completed');
    expect((await getQuest(db, a1.id)).status).toBe('completed');
    expect((await getQuest(db, a2.id)).status).toBe('completed');

    // (b) player: parent + the two still-active children only — the pre-completed one is not
    // re-counted (no double XP).
    const player = await getPlayer(db, USER);
    expect(player.xp).toBe(10 + 25 + 100); // 135, NOT + 50
    expect(result.player.xp).toBe(135);

    // (c) log: three new rows, none of them the already-completed sub-task (no duplicate).
    const completions = await getCompletions(db, USER);
    expect(completions).toHaveLength(3);
    expect(completions.map((r) => r.questId)).not.toContain(done.id);
    expect(new Set(completions.map((r) => r.questId))).toEqual(new Set([parent.id, a1.id, a2.id]));
  });

  it('3. leaf quest: behaves exactly like an ordinary complete', async () => {
    await seedUser(db, USER);
    const parent = await seedQuest(db, { userId: USER, difficulty: 'A', title: 'Solo' }); // 250

    const result = expectSuccess(await completeQuestCascade(db, USER, parent.id));

    expect(result.cascadedCompletions).toBe(0);
    expect((await getQuest(db, parent.id)).status).toBe('completed');

    const player = await getPlayer(db, USER);
    expect(player.xp).toBe(250); // level 2 (250 ≥ 100, < 100+282)
    expect(player.level).toBe(2);
    expect(result.leveledUp).toBe(true);

    const completions = await getCompletions(db, USER);
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({ questId: parent.id, title: 'Solo', difficulty: 'A', xpAwarded: 250 });
  });

  it('4. level-up reached only by the summed XP', async () => {
    // Level 1→2 needs 100 XP. No single reward here is ≥ 100, so neither the parent nor any
    // child crosses the threshold alone; their sum (110) does. Guards "compute leveledUp
    // after the whole cascade" — a parent-only reading would report false.
    await seedUser(db, USER);
    const parent = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'P' }); // 10
    const c1 = await seedQuest(db, { userId: USER, difficulty: 'C', title: 'C1', parentId: parent.id }); // 50
    const c2 = await seedQuest(db, { userId: USER, difficulty: 'C', title: 'C2', parentId: parent.id }); // 50
    expect([10, 50, 50].every((r) => r < 100)).toBe(true);

    const result = expectSuccess(await completeQuestCascade(db, USER, parent.id));

    expect(result.leveledUp).toBe(true);
    expect(result.player.level).toBe(2);
    const player = await getPlayer(db, USER);
    expect(player.xp).toBe(110);
    expect(player.level).toBe(2);
    expect((await getCompletions(db, USER))).toHaveLength(3);
    // sanity: c1/c2 both closed
    expect((await getQuest(db, c1.id)).status).toBe('completed');
    expect((await getQuest(db, c2.id)).status).toBe('completed');
  });

  it('5. rollback: a failure mid-cascade leaves nothing changed', async () => {
    // Force a genuine DB error partway through, no db/grantXp faking: seed the user one
    // parent-reward below int4's max, so the PARENT grant lands exactly on INT4_MAX (its
    // status + completion row get written), then the first CHILD grant overflows int4 and
    // Postgres aborts the transaction. If rollback works, none of the parent's writes survive.
    await seedUser(db, USER, INT4_MAX - 10);
    const parent = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'Raid' }); // 10 → INT4_MAX
    const child = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'Sub', parentId: parent.id }); // +10 → overflow

    await expect(completeQuestCascade(db, USER, parent.id)).rejects.toThrow();

    // (a) statuses: parent AND child untouched.
    expect((await getQuest(db, parent.id)).status).toBe('active');
    expect((await getQuest(db, child.id)).status).toBe('active');
    // (b) player: XP and level exactly as seeded — the parent's grant rolled back too.
    const player = await getPlayer(db, USER);
    expect(player.xp).toBe(INT4_MAX - 10);
    expect(player.level).toBe(1);
    // (c) log: not a single completion row written.
    expect(await getCompletions(db, USER)).toHaveLength(0);
  });

  it('6. ownership: a foreign sub-task under the same parent is never closed', async () => {
    // The API blocks creating a cross-user sub-task (a parent must be owned), so this state
    // is unreachable through routes — but the cascade scopes its child query by userId rather
    // than trusting parentId, and this asserts that guard directly at the DB layer.
    await seedUser(db, USER);
    await seedUser(db, 'user-b');
    const parent = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'Mine' }); // 10
    const foreign = await seedQuest(db, { userId: 'user-b', difficulty: 'S', title: 'Theirs', parentId: parent.id }); // 500

    const result = expectSuccess(await completeQuestCascade(db, USER, parent.id));

    expect(result.cascadedCompletions).toBe(0);
    // (a) foreign child stays active; parent completed.
    expect((await getQuest(db, foreign.id)).status).toBe('active');
    expect((await getQuest(db, parent.id)).status).toBe('completed');
    // (b) only the parent's XP is granted, to its owner; the other user gains nothing.
    expect((await getPlayer(db, USER)).xp).toBe(10);
    expect((await getPlayer(db, 'user-b')).xp).toBe(0);
    // (c) one row (the parent), owned by USER; nothing logged for the foreign quest.
    const mine = await getCompletions(db, USER);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.questId).toBe(parent.id);
    expect(await getCompletions(db, 'user-b')).toHaveLength(0);
  });
});
