import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { quests, questTags, tags, user } from '@soloquest/db/schema';
import {
  XP_REWARDS,
  TAG_COLORS,
  tagColorForName,
  createTagSchema,
  updateTagSchema,
} from '@soloquest/shared';
import { createTestDb, type TestDb } from '../test/db';
import {
  assertOwnedTags,
  createOrGetTag,
  deleteTag,
  listUserTags,
  updateTag,
  setQuestTags,
} from './tags';
import { completeQuestCascade } from './quest-completions';
import type { DrizzleDB } from './db';

// Tag persistence, exercised on a real (pglite) database — nothing about `db` is mocked.
// The focus is the invariants the UI can't be trusted to hold: normalized uniqueness,
// ownership, replace-not-append, cascade on delete, and rename-collision.

async function seedUser(db: DrizzleDB, id: string): Promise<void> {
  await db.insert(user).values({ id, name: `Hunter ${id}`, email: `${id}@example.com` });
}

async function seedQuest(db: DrizzleDB, userId: string, title: string) {
  const [q] = await db
    .insert(quests)
    .values({ userId, title, difficulty: 'E', xpReward: XP_REWARDS.E })
    .returning();
  return q!;
}

async function tagRows(db: DrizzleDB, userId: string) {
  return db.select().from(tags).where(eq(tags.userId, userId));
}
async function linkRows(db: DrizzleDB, questId: string) {
  return db.select().from(questTags).where(eq(questTags.questId, questId));
}

describe('tags', () => {
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

  it('1. normalizes and dedupes: Dom / dom / " DOM " collapse to one tag', async () => {
    await seedUser(db, USER);

    const first = await createOrGetTag(db, USER, 'Dom');
    const second = await createOrGetTag(db, USER, 'dom');
    const third = await createOrGetTag(db, USER, ' DOM ');

    // Second and third calls return the existing row, never a new one.
    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);

    const rows = await tagRows(db, USER);
    expect(rows).toHaveLength(1);
    // Display spelling is the original; normalized is trim+lowercase.
    expect(rows[0]!.name).toBe('Dom');
    expect(rows[0]!.normalizedName).toBe('dom');
  });

  it('2. ownership: user A cannot pin user B\'s tag to A\'s quest', async () => {
    await seedUser(db, USER);
    await seedUser(db, 'user-b');
    const questA = await seedQuest(db, USER, 'Mine');
    const tagB = await createOrGetTag(db, 'user-b', 'Theirs');

    expect(await assertOwnedTags(db, USER, [tagB.id])).toBe(false);

    const result = await setQuestTags(db, USER, questA.id, [tagB.id]);
    expect(result).toEqual({ error: 'foreign_tag' });

    // Nothing written — the foreign tag is rejected, not silently dropped.
    expect(await linkRows(db, questA.id)).toHaveLength(0);
  });

  it('3. replace (not append): setQuestTags installs exactly the given set', async () => {
    await seedUser(db, USER);
    const quest = await seedQuest(db, USER, 'Q');
    const t1 = await createOrGetTag(db, USER, 'one');
    const t2 = await createOrGetTag(db, USER, 'two');
    const t3 = await createOrGetTag(db, USER, 'three');

    expect(await setQuestTags(db, USER, quest.id, [t1.id, t2.id])).toEqual({ ok: true });
    expect(await setQuestTags(db, USER, quest.id, [t2.id, t3.id])).toEqual({ ok: true });

    const links = await linkRows(db, quest.id);
    expect(links).toHaveLength(2);
    // t1 dropped, t3 added, t2 kept — the second call replaced the set, not merged into it.
    expect(new Set(links.map((l) => l.tagId))).toEqual(new Set([t2.id, t3.id]));
  });

  it('4. delete cascades to quest_tags but leaves the quest', async () => {
    await seedUser(db, USER);
    const quest = await seedQuest(db, USER, 'Q');
    const tag = await createOrGetTag(db, USER, 'work');
    await setQuestTags(db, USER, quest.id, [tag.id]);
    expect(await linkRows(db, quest.id)).toHaveLength(1);

    expect(await deleteTag(db, USER, tag.id)).toBe(true);

    // Link gone via cascade; quest untouched.
    expect(await db.select().from(questTags).where(eq(questTags.tagId, tag.id))).toHaveLength(0);
    expect(await db.select().from(quests).where(eq(quests.id, quest.id))).toHaveLength(1);
  });

  it('5. rename collision is rejected and leaves state unchanged', async () => {
    await seedUser(db, USER);
    const work = await createOrGetTag(db, USER, 'Work');
    const home = await createOrGetTag(db, USER, 'Home');

    // Renaming Home → "work" collides (normalized) with the existing Work tag.
    const result = await updateTag(db, USER, home.id, { name: 'work' });
    expect(result).toEqual({ error: 'name_taken' });

    // Home is untouched — neither name nor normalizedName moved.
    const [h] = await db.select().from(tags).where(eq(tags.id, home.id));
    expect(h!.name).toBe('Home');
    expect(h!.normalizedName).toBe('home');
    // Work is still exactly one row.
    expect((await tagRows(db, USER)).filter((t) => t.normalizedName === 'work')).toHaveLength(1);

    // A case-only rename of the SAME tag is allowed (it "collides" only with itself).
    const ok = await updateTag(db, USER, work.id, { name: 'WORK' });
    expect('tag' in ok).toBe(true);
    if ('tag' in ok) {
      expect(ok.tag.name).toBe('WORK');
      expect(ok.tag.normalizedName).toBe('work');
    }
  });

  it('6. listUserTags reports per-tag usage counts', async () => {
    await seedUser(db, USER);
    const q1 = await seedQuest(db, USER, 'Q1');
    const q2 = await seedQuest(db, USER, 'Q2');
    const used = await createOrGetTag(db, USER, 'used');
    const unused = await createOrGetTag(db, USER, 'unused');
    await setQuestTags(db, USER, q1.id, [used.id]);
    await setQuestTags(db, USER, q2.id, [used.id]);

    const list = await listUserTags(db, USER);
    const byId = new Map(list.map((t) => [t.id, t]));
    expect(byId.get(used.id)!.usageCount).toBe(2);
    expect(byId.get(unused.id)!.usageCount).toBe(0);
  });

  it('7. default colour is deterministic and drawn from the palette', async () => {
    await seedUser(db, USER);

    const tag = await createOrGetTag(db, USER, 'Alpha');
    // The stored colour is a palette member and equals the pure derivation from the name.
    expect(TAG_COLORS).toContain(tag.color);
    expect(tag.color).toBe(tagColorForName('alpha'));

    // Same normalized name → same colour, every time.
    expect(tagColorForName('alpha')).toBe(tagColorForName('alpha'));

    // Different names spread across the palette (not all one shade), and each is valid.
    const names = ['home', 'work', 'urgent', 'health', 'study', 'errand', 'fun', 'money'];
    const colors = new Set(names.map((n) => tagColorForName(n)));
    expect(colors.size).toBeGreaterThan(1);
    for (const n of names) expect(TAG_COLORS).toContain(tagColorForName(n));
  });

  it('8. validation rejects a colour outside the palette (no write reaches the DB)', () => {
    // The guard is the Zod schema at the route boundary — an off-palette colour never reaches
    // the lib, so there is nothing to persist.
    expect(createTagSchema.safeParse({ name: 'x', color: 'amethyst' }).success).toBe(true);
    expect(createTagSchema.safeParse({ name: 'x', color: 'chartreuse' }).success).toBe(false);
    expect(updateTagSchema.safeParse({ color: 'not-a-colour' }).success).toBe(false);
  });

  it('9. recolour changes only the colour — name, normalization and pins untouched', async () => {
    await seedUser(db, USER);
    const quest = await seedQuest(db, USER, 'Q');
    const tag = await createOrGetTag(db, USER, 'Home');
    await setQuestTags(db, USER, quest.id, [tag.id]);

    const newColor = tag.color === 'teal' ? 'crimson' : 'teal';
    const res = await updateTag(db, USER, tag.id, { color: newColor });

    expect('tag' in res).toBe(true);
    if ('tag' in res) {
      expect(res.tag.color).toBe(newColor);
      expect(res.tag.name).toBe('Home');
      expect(res.tag.normalizedName).toBe('home');
    }
    // The pin survives a recolour.
    expect(await linkRows(db, quest.id)).toHaveLength(1);
  });

  it('10. usageCount counts all quests (any status) — unchanged by completion', async () => {
    await seedUser(db, USER);
    const quest = await seedQuest(db, USER, 'Q');
    const tag = await createOrGetTag(db, USER, 'chore');
    await setQuestTags(db, USER, quest.id, [tag.id]);

    const before = await listUserTags(db, USER);
    expect(before.find((t) => t.id === tag.id)!.usageCount).toBe(1);

    // Completing keeps the quest row and its pin — so the count must not move.
    const result = await completeQuestCascade(db, USER, quest.id);
    expect('error' in result).toBe(false);

    const after = await listUserTags(db, USER);
    expect(after.find((t) => t.id === tag.id)!.usageCount).toBe(1);
  });

  it('11. a new tag after a recolour keeps its own deterministic colour (no leak)', async () => {
    // The exact bug sequence, driven the way the app does it: on-the-fly creation posts a name
    // with NO colour, so at this boundary that is createOrGetTag(db, user, name) — color absent.
    await seedUser(db, USER);

    const a = await createOrGetTag(db, USER, 'alpha'); // picker create — no colour
    expect(a.color).toBe(tagColorForName('alpha'));

    // User recolours A to something that is neither A's nor B's deterministic colour.
    const forced: (typeof TAG_COLORS)[number] = 'crimson';
    expect(forced).not.toBe(tagColorForName('alpha'));
    expect(forced).not.toBe(tagColorForName('beta'));
    await updateTag(db, USER, a.id, { color: forced });

    const b = await createOrGetTag(db, USER, 'beta'); // picker create — no colour
    // B must derive its OWN colour from its name, not inherit A's forced colour.
    expect(b.color).toBe(tagColorForName('beta'));
    expect(b.color).not.toBe(forced);
  });

  it('12. recolouring one tag never touches another tag', async () => {
    await seedUser(db, USER);
    const a = await createOrGetTag(db, USER, 'alpha');
    const b = await createOrGetTag(db, USER, 'beta');
    const bColorBefore = b.color;

    await updateTag(db, USER, a.id, { color: 'crimson' });

    const [bAfter] = await db.select().from(tags).where(eq(tags.id, b.id));
    expect(bAfter!.color).toBe(bColorBefore);
  });
});
