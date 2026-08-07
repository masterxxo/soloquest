import type { Quest, RecurringQuestWithStreak, TagWithUsage } from '~/lib/api-client';

// Client-side snapshot of the per-user list stores (quests + rituals + tags). Survives a
// hard refresh so the board can paint from localStorage before the network round-trip
// lands. Server remains authoritative — every boot and every TTL/visibility tick revalidates.
//
// Keys are scoped by user id so a shared browser cannot leak one player's lists into
// another's session. Cleared on sign-out.

export const LIST_CACHE_TTL_MS = 5 * 60 * 1000;
/** When a hidden tab becomes visible, refresh if the snapshot is older than this. */
export const LIST_CACHE_VISIBILITY_MAX_AGE_MS = 2 * 60 * 1000;
const CACHE_VERSION = 1 as const;

export interface QuestsListSnapshot {
  v: typeof CACHE_VERSION;
  fetchedAt: number;
  /** Local calendar day (YYYY-MM-DD) the lists were fetched for — day-sensitive flags. */
  loadedDate: string;
  activeQuests: Quest[];
  doneTodayQuests: Quest[];
  recurringQuests: RecurringQuestWithStreak[];
}

export interface TagsListSnapshot {
  v: typeof CACHE_VERSION;
  fetchedAt: number;
  tags: TagWithUsage[];
}

function questsKey(userId: string) {
  return `soloquest:lists:quests:${userId}`;
}

function tagsKey(userId: string) {
  return `soloquest:lists:tags:${userId}`;
}

function readJson<T>(key: string): T | null {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — ignore; network fetch still works.
  }
}

export function isCacheFresh(fetchedAt: number | null | undefined, maxAgeMs = LIST_CACHE_TTL_MS): boolean {
  if (fetchedAt == null) return false;
  return Date.now() - fetchedAt < maxAgeMs;
}

export function readQuestsListCache(userId: string): QuestsListSnapshot | null {
  const snap = readJson<QuestsListSnapshot>(questsKey(userId));
  if (!snap || snap.v !== CACHE_VERSION) return null;
  if (!Array.isArray(snap.activeQuests) || !Array.isArray(snap.doneTodayQuests) || !Array.isArray(snap.recurringQuests))
    return null;
  if (typeof snap.fetchedAt !== 'number' || typeof snap.loadedDate !== 'string') return null;
  return snap;
}

export function writeQuestsListCache(userId: string, snapshot: Omit<QuestsListSnapshot, 'v'>) {
  writeJson(questsKey(userId), { v: CACHE_VERSION, ...snapshot } satisfies QuestsListSnapshot);
}

export function readTagsListCache(userId: string): TagsListSnapshot | null {
  const snap = readJson<TagsListSnapshot>(tagsKey(userId));
  if (!snap || snap.v !== CACHE_VERSION) return null;
  if (!Array.isArray(snap.tags) || typeof snap.fetchedAt !== 'number') return null;
  return snap;
}

export function writeTagsListCache(userId: string, snapshot: Omit<TagsListSnapshot, 'v'>) {
  writeJson(tagsKey(userId), { v: CACHE_VERSION, ...snapshot } satisfies TagsListSnapshot);
}

export function clearListCaches(userId: string) {
  if (!import.meta.client) return;
  try {
    localStorage.removeItem(questsKey(userId));
    localStorage.removeItem(tagsKey(userId));
  } catch {
    // ignore
  }
}
