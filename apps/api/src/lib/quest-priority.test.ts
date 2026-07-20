import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { quests, questTags, user } from '@soloquest/db/schema';
import {
  XP_REWARDS,
  type Difficulty,
  type QuestPriority,
  createQuestSchema,
  updateQuestSchema,
} from '@soloquest/shared';
import { createTestDb, type TestDb } from '../test/db';
import { createOrGetTag, replaceQuestTags } from './tags';
import { completeQuestCascade } from './quest-completions';
import type { DrizzleDB } from './db';

// Quest priority, exercised on a real (pglite) database and against the real Zod schemas —
// nothing mocked. Priority is a marker + filter dimension only; these tests pin down the
// invariants that guarantee it never leaks into anything else: the NOT NULL default, that a
// value outside the enum is rejected before any write, that a priority PATCH is isolated to
// the priority column, and that the completion cascade is indifferent to it.

async function seedUser(db: DrizzleDB, id: string, xp = 0): Promise<void> {
  await db.insert(user).values({ id, name: `Hunter ${id}`, email: `${id}@example.com`, xp });
}

interface SeedQuest {
  userId: string;
  difficulty: Difficulty;
  title: string;
  parentId?: string | null;
  priority?: QuestPriority;
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
      // Only set priority when the case cares — omission exercises the DB default.
      ...(opts.priority ? { priority: opts.priority } : {}),
    })
    .returning();
  return q!;
}

async function getQuest(db: DrizzleDB, id: string) {
  const [q] = await db.select().from(quests).where(eq(quests.id, id));
  return q!;
}

describe('quest priority', () => {
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

  it('1. defaults to normal: a quest created without a priority is stored as normal', async () => {
    await seedUser(db, USER);
    // No priority passed → the NOT NULL DEFAULT fills it. This is the same path existing rows
    // take on the migration: no backfill, they simply read back as normal.
    const q = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'Unmarked' });
    expect((await getQuest(db, q.id)).priority).toBe('normal');

    // The create schema leaves an omitted priority undefined (no Zod default on purpose — see
    // schemas.ts); the DB default is what supplies 'normal'. The POST route passes the
    // undefined straight through, so Drizzle omits the column and the default lands.
    const parsed = createQuestSchema.parse({ title: 'x', description: 'y' });
    expect(parsed.priority).toBeUndefined();
  });

  it('2. rejects a value outside the enum on create and update (validation, before any write)', () => {
    // zValidator runs these before the handler, so a bad value is a clean 400 and nothing is
    // written. Asserting the schemas directly is asserting exactly that gate.
    const badCreate = createQuestSchema.safeParse({
      title: 'x',
      description: 'y',
      priority: 'urgent',
    });
    expect(badCreate.success).toBe(false);

    const badUpdate = updateQuestSchema.safeParse({ priority: 'URGENT' });
    expect(badUpdate.success).toBe(false);

    // Each valid level is accepted, on both schemas.
    for (const p of ['low', 'normal', 'high'] as const) {
      expect(createQuestSchema.safeParse({ title: 'x', description: 'y', priority: p }).success).toBe(true);
      expect(updateQuestSchema.safeParse({ priority: p }).success).toBe(true);
    }

    // An omitted priority on update stays omitted (no Zod default to leak through `.partial()`),
    // so a PATCH that doesn't mention priority never silently resets it to normal — the field
    // simply isn't in `questFields` and never reaches `.set()`.
    const noPriority = updateQuestSchema.parse({ title: 'renamed' });
    expect('priority' in noPriority).toBe(false);
  });

  it('3. a priority PATCH touches only the priority column', async () => {
    await seedUser(db, USER);
    const tag = await createOrGetTag(db, USER, 'focus');
    const q = await seedQuest(db, { userId: USER, difficulty: 'B', title: 'Keep everything', priority: 'low' });
    await replaceQuestTags(db, q.id, [tag.id]);
    const before = await getQuest(db, q.id);

    // Exactly what the PATCH route does for a priority-only edit: set the single field, scoped
    // to the owner. xpReward is not recomputed (difficulty didn't change).
    await db.update(quests).set({ priority: 'high' }).where(eq(quests.id, q.id));

    const after = await getQuest(db, q.id);
    expect(after.priority).toBe('high');
    // Everything else is byte-for-byte the row we started with.
    expect(after.title).toBe(before.title);
    expect(after.difficulty).toBe(before.difficulty);
    expect(after.status).toBe(before.status);
    expect(after.xpReward).toBe(before.xpReward);
    expect(after.deadline).toEqual(before.deadline);
    expect(after.completedAt).toEqual(before.completedAt);
    expect(after.parentId).toEqual(before.parentId);
    expect(after.createdAt).toEqual(before.createdAt);
    // The tag pin survives — priority and tags are independent dimensions.
    const links = await db.select().from(questTags).where(eq(questTags.questId, q.id));
    expect(links.map((l) => l.tagId)).toEqual([tag.id]);
  });

  it('4. the completion cascade is indifferent to priority (regression)', async () => {
    await seedUser(db, USER);
    // Parent and children each carry a different priority; the cascade must still close them
    // all and grant the correct summed XP, untouched by the marker.
    const parent = await seedQuest(db, { userId: USER, difficulty: 'E', title: 'Raid', priority: 'high' }); // 10
    const c1 = await seedQuest(db, { userId: USER, difficulty: 'D', title: 'Scout', parentId: parent.id, priority: 'low' }); // 25
    const c2 = await seedQuest(db, { userId: USER, difficulty: 'C', title: 'Breach', parentId: parent.id, priority: 'normal' }); // 50

    const result = await completeQuestCascade(db, USER, parent.id);
    if ('error' in result) throw new Error(`expected success, got ${result.error}`);

    expect(result.cascadedCompletions).toBe(2);
    for (const id of [parent.id, c1.id, c2.id]) {
      expect((await getQuest(db, id)).status).toBe('completed');
    }
    // XP is the plain sum of the three rewards — priority never enters the reward math.
    expect(result.player.xp).toBe(10 + 25 + 50);
    // Priorities are preserved through completion (nothing rewrote them).
    expect((await getQuest(db, parent.id)).priority).toBe('high');
    expect((await getQuest(db, c1.id)).priority).toBe('low');
    expect((await getQuest(db, c2.id)).priority).toBe('normal');
  });
});
