import { and, count, desc, eq, gte, lt, or, sql } from 'drizzle-orm';
import { questCompletions } from '@soloquest/db/schema';
import { DIFFICULTY_ORDER, type Difficulty } from '@soloquest/shared';
import type { DrizzleDB } from './db';
import type { Quest } from './quests';
import { MS_PER_DAY } from './constants';
import { getUserDate, toDateString } from './recurrence';

export type QuestCompletionInsert = typeof questCompletions.$inferInsert;

/**
 * Build the completion event for a quest that is being completed right now.
 *
 * Title, difficulty and XP are copied out of the quest rather than referenced through
 * `questId`: the FK is `SET NULL`, so the event outlives the quest, and it has to carry
 * enough of the quest with it to still make sense on its own. `xpAwarded` is the XP the
 * player actually received, not `XP_REWARDS[difficulty]` recomputed later — the reward
 * table may change, but what was granted at the time must not.
 */
export function buildQuestCompletion(
  quest: Quest,
  xpAwarded: number,
  completedAt: Date,
): QuestCompletionInsert {
  return {
    userId: quest.userId,
    questId: quest.id,
    title: quest.title,
    difficulty: quest.difficulty,
    xpAwarded,
    completedAt,
  };
}

/**
 * Lifetime number of quests the user has completed. Counted in the database — the rows
 * are an append-only log that only grows, so there is nothing to fetch and tally client-side.
 */
export async function countQuestCompletions(
  database: DrizzleDB,
  userId: string,
): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(questCompletions)
    .where(eq(questCompletions.userId, userId));
  return row?.total ?? 0;
}

// ── Chronicles (UI name) read models over the completion log ────────────────────────
// Everything below powers the read-only history view. The name "Chronicles" is a UI label
// only; here the vocabulary stays `quest-completions`, and every calendar date is derived
// from the raw `completedAt` instant through the user's timezone (getUserDate), never from
// a UTC truncation — the same discipline as the ritual heatmap.

// How many days the daily-XP timeline covers, counting back from today (inclusive).
export const TIMELINE_DAYS = 30;

/** One day in the timeline: XP earned and quests completed on that calendar day. */
export interface TimelineDay {
  date: string; // 'YYYY-MM-DD' in the user's timezone
  xp: number;
  count: number;
}

export interface CompletionSummary {
  totalCompleted: number;
  totalXp: number;
  byRank: Record<Difficulty, number>;
  timeline: TimelineDay[];
}

/**
 * All-time aggregates plus the last {@link TIMELINE_DAYS} days of daily XP, for the
 * Chronicles header. `totalCompleted` is a COUNT over the same rows the /stats route
 * counts (the append-only log filtered by userId), so the two can never disagree.
 * The timeline is bucketed in application code by the user's calendar day (getUserDate),
 * with every day in the window present — days without completions carry zeros so the
 * chart has a continuous axis rather than gaps.
 */
export async function getCompletionSummary(
  database: DrizzleDB,
  userId: string,
  timezone: string,
): Promise<CompletionSummary> {
  // All-time totals, grouped by rank in one pass.
  const rankRows = await database
    .select({
      difficulty: questCompletions.difficulty,
      count: count(),
      xp: sql<string>`coalesce(sum(${questCompletions.xpAwarded}), 0)`,
    })
    .from(questCompletions)
    .where(eq(questCompletions.userId, userId))
    .groupBy(questCompletions.difficulty);

  // Seed every canonical rank at zero so absent ranks still appear (no `undefined` holes).
  const byRank = Object.fromEntries(
    DIFFICULTY_ORDER.map((rank) => [rank, 0] as const),
  ) as Record<Difficulty, number>;
  let totalCompleted = 0;
  let totalXp = 0;
  for (const row of rankRows) {
    byRank[row.difficulty] = row.count;
    totalCompleted += row.count;
    totalXp += Number(row.xp);
  }

  // Timeline window: [today − (TIMELINE_DAYS − 1), today], all in the user's calendar days.
  const today = getUserDate(new Date(), timezone);
  const windowStart = new Date(today.getTime() - (TIMELINE_DAYS - 1) * MS_PER_DAY);
  // Over-fetch by a day on the low side: windowStart is UTC midnight of the user's local
  // day, and a completion on that local day can sit up to a timezone-offset earlier/later
  // in UTC. We re-bucket every row precisely by getUserDate below and drop anything that
  // falls outside the window, so the buffer only widens the (indexed) range scan.
  const queryFrom = new Date(windowStart.getTime() - MS_PER_DAY);
  const windowRows = await database
    .select({
      completedAt: questCompletions.completedAt,
      xpAwarded: questCompletions.xpAwarded,
    })
    .from(questCompletions)
    .where(
      and(
        eq(questCompletions.userId, userId),
        gte(questCompletions.completedAt, queryFrom),
      ),
    );

  const buckets = new Map<string, { xp: number; count: number }>();
  for (const row of windowRows) {
    const date = toDateString(getUserDate(row.completedAt, timezone));
    const bucket = buckets.get(date);
    if (bucket) {
      bucket.xp += row.xpAwarded;
      bucket.count += 1;
    } else {
      buckets.set(date, { xp: row.xpAwarded, count: 1 });
    }
  }

  const timeline: TimelineDay[] = [];
  for (let i = 0; i < TIMELINE_DAYS; i++) {
    const date = toDateString(new Date(windowStart.getTime() + i * MS_PER_DAY));
    const bucket = buckets.get(date);
    timeline.push({ date, xp: bucket?.xp ?? 0, count: bucket?.count ?? 0 });
  }

  return { totalCompleted, totalXp, byRank, timeline };
}

/** One row of the completion log, snapshot-only (the quest itself may be long gone). */
export interface CompletionLogEntry {
  id: string;
  title: string;
  difficulty: Difficulty;
  xpAwarded: number;
  completedAt: Date; // serialized to an ISO string over the wire
  completedDate: string; // 'YYYY-MM-DD' calendar day in the user's timezone
}

export interface CompletionLogPage {
  items: CompletionLogEntry[];
  nextCursor: string | null;
}

// Keyset cursor over (completedAt DESC, id DESC). Opaque to the client: an ISO instant and
// the row id, base64url-encoded. id breaks ties when two completions share a timestamp.
function encodeCursor(completedAt: Date, id: string): string {
  return Buffer.from(`${completedAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { completedAt: Date; id: string } | null {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const sep = raw.lastIndexOf('|');
  if (sep === -1) return null;
  const completedAt = new Date(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (Number.isNaN(completedAt.getTime()) || !id) return null;
  return { completedAt, id };
}

/**
 * A page of the completion log, newest first, via keyset pagination on
 * (completedAt DESC, id DESC) — stable under inserts and cheap at any depth, unlike OFFSET.
 * `completedDate` is the user-timezone calendar day of each completion, computed here so the
 * frontend only ever does relative labelling ("Today"/"Yesterday") on a safe string.
 * A malformed cursor is treated as "from the start" rather than an error.
 */
export async function getCompletionLog(
  database: DrizzleDB,
  userId: string,
  timezone: string,
  limit: number,
  cursor?: string,
): Promise<CompletionLogPage> {
  const decoded = cursor ? decodeCursor(cursor) : null;
  const keyset = decoded
    ? or(
        lt(questCompletions.completedAt, decoded.completedAt),
        and(
          eq(questCompletions.completedAt, decoded.completedAt),
          lt(questCompletions.id, decoded.id),
        ),
      )
    : undefined;

  // Fetch one extra row: its presence means there is a further page to hand back a cursor for.
  const rows = await database
    .select({
      id: questCompletions.id,
      title: questCompletions.title,
      difficulty: questCompletions.difficulty,
      xpAwarded: questCompletions.xpAwarded,
      completedAt: questCompletions.completedAt,
    })
    .from(questCompletions)
    .where(and(eq(questCompletions.userId, userId), keyset))
    .orderBy(desc(questCompletions.completedAt), desc(questCompletions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items: CompletionLogEntry[] = page.map((row) => ({
    ...row,
    completedDate: toDateString(getUserDate(row.completedAt, timezone)),
  }));

  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.completedAt, last.id) : null;
  return { items, nextCursor };
}
