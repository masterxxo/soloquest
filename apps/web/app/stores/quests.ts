import { defineStore } from 'pinia';
import {
  client,
  type Quest,
  type QuestWithWarnings,
  type CompleteResult,
  type RecurringQuest,
  type RecurringQuestWithStreak,
  type RecurringCompleteResult,
} from '~/lib/api-client';
import { usePlayerStore } from '~/stores/player';
import { useFeedbackStore } from '~/stores/feedback';
import { useTagsStore } from '~/stores/tags';
import { localDateString } from '~/lib/date';
import {
  isCacheFresh,
  LIST_CACHE_TTL_MS,
  readQuestsListCache,
  writeQuestsListCache,
} from '~/lib/list-cache';
import type { TagColor } from '@soloquest/shared';

// Single client-side cache for the per-user lists. It outlives individual pages (the
// persistent layout + several routes all read the same arrays), applies the
// server-authoritative results of mutations straight from their responses, and persists a
// snapshot to localStorage so a hard refresh can paint before the network returns.
//
// Freshness: TTL (5 min) + visibility / interval revalidation in useListCacheSync. Cold boot
// always revalidates. Day-sensitive flags still invalidate across midnight via loadedDate.
//
// View/modal state (selected quest, form toggles) stays local to the page — only the
// shared lists and their mutations live here.
export type CompletableKind = 'quest' | 'recurring';

interface QuestsState {
  activeQuests: Quest[];
  // Top-level quests completed *today* in the user's timezone — the board's "DONE TODAY"
  // strip. Seeded from the list load (server-filtered to today) and appended to live as
  // quests complete, so it needs no refetch; naturally empties tomorrow (a fresh load past
  // midnight refetches and the old completions no longer match today). Read-only surface:
  // its rows open a preview, never a mutation. See the DONE TODAY section on the Quests page.
  doneTodayQuests: Quest[];
  recurringQuests: RecurringQuestWithStreak[];
  loaded: boolean;
  // True while a network refresh is in flight. Distinguishes "still waiting for first
  // paint" (loading && !loaded) from a background SWR refresh over already-shown data.
  loading: boolean;
  // Local calendar day the lists were last fetched on (YYYY-MM-DD). The server-computed
  // day-sensitive flags (isCompletedToday / isDueToday, overdue) are only valid for the
  // day they were fetched, so we track this to invalidate the cache across midnight.
  loadedDate: string | null;
  // Wall-clock ms of the last successful network fetch — drives the TTL.
  fetchedAt: number | null;
  // Owner of the in-memory + localStorage snapshot; set by boot().
  userId: string | null;
  // Ids with a completion request currently in flight. Kept here rather than in the
  // component so the list card and the open detail modal — two separate instances of
  // useQuestActions / useRecurringQuestActions for the same entity — share one guard.
  completingQuestIds: string[];
  completingRecurringIds: string[];
}

// Dedup concurrent refresh() callers (layout boot + page load + interval).
let questsRefreshInflight: Promise<void> | null = null;

export const useQuestsStore = defineStore('quests', {
  state: (): QuestsState => ({
    activeQuests: [],
    doneTodayQuests: [],
    recurringQuests: [],
    loaded: false,
    loading: false,
    loadedDate: null,
    fetchedAt: null,
    userId: null,
    completingQuestIds: [],
    completingRecurringIds: [],
  }),
  getters: {
    isCompleting: (state) => (kind: CompletableKind, id: string) =>
      (kind === 'quest' ? state.completingQuestIds : state.completingRecurringIds).includes(id),
    // First paint with no snapshot yet. Soft refreshes over cached/hydrated data keep
    // `loaded` true so this stays false (no flash of the loading shell).
    isInitialLoading: (state) => state.loading && !state.loaded,
  },
  actions: {
    // ── In-flight completions ───────────────────────────────────────────────
    // Completing is the one mutation that must never run twice for the same entity: a
    // duplicate one-off complete would double-grant XP, and a duplicate ritual complete
    // is rejected by the backend with a 409. Claiming the id is synchronous, so it also
    // closes the gap between the two clicks of a double-click and the DOM patch that
    // disables the button.
    beginComplete(kind: CompletableKind, id: string): boolean {
      const ids = kind === 'quest' ? this.completingQuestIds : this.completingRecurringIds;
      if (ids.includes(id)) return false;
      ids.push(id);
      return true;
    },
    endComplete(kind: CompletableKind, id: string) {
      if (kind === 'quest')
        this.completingQuestIds = this.completingQuestIds.filter((x) => x !== id);
      else this.completingRecurringIds = this.completingRecurringIds.filter((x) => x !== id);
    },

    reset() {
      this.activeQuests = [];
      this.doneTodayQuests = [];
      this.recurringQuests = [];
      this.loaded = false;
      this.loading = false;
      this.loadedDate = null;
      this.fetchedAt = null;
      this.userId = null;
      this.completingQuestIds = [];
      this.completingRecurringIds = [];
      questsRefreshInflight = null;
    },

    // Sync hydrate from localStorage. Ignores a snapshot from another calendar day —
    // day-sensitive flags (done/due today, DONE TODAY strip) would be wrong.
    hydrateFromCache() {
      if (!this.userId) return;
      const snap = readQuestsListCache(this.userId);
      if (!snap) return;
      if (snap.loadedDate !== localDateString()) return;
      this.activeQuests = snap.activeQuests;
      this.doneTodayQuests = snap.doneTodayQuests;
      this.recurringQuests = snap.recurringQuests;
      this.loaded = true;
      this.loadedDate = snap.loadedDate;
      this.fetchedAt = snap.fetchedAt;
    },

    persist() {
      if (!this.userId || !this.loaded || this.loadedDate == null || this.fetchedAt == null) return;
      writeQuestsListCache(this.userId, {
        fetchedAt: this.fetchedAt,
        loadedDate: this.loadedDate,
        activeQuests: this.activeQuests,
        doneTodayQuests: this.doneTodayQuests,
        recurringQuests: this.recurringQuests,
      });
    },

    // Layout entry: bind the user, paint from snapshot if any, always revalidate.
    async boot(userId: string) {
      if (this.userId !== userId) {
        this.reset();
        this.userId = userId;
      } else if (!this.userId) {
        this.userId = userId;
      }
      this.hydrateFromCache();
      await this.refresh({ force: true });
    },

    // Pages call this on mount; with a live boot it is a TTL-gated soft refresh.
    async load() {
      if (!this.userId) return;
      if (!this.loaded) this.hydrateFromCache();
      await this.refreshIfStale();
    },

    // Soft refresh when older than maxAge (default TTL), or when the calendar day changed.
    async refreshIfStale(maxAgeMs = LIST_CACHE_TTL_MS) {
      const today = localDateString();
      if (
        this.loaded &&
        this.loadedDate === today &&
        isCacheFresh(this.fetchedAt, maxAgeMs)
      ) {
        return;
      }
      await this.refresh();
    },

    // Network fetch. Never clears lists before the response (SWR). Skips while a complete
    // is in flight unless force (boot) — avoids clobbering optimistic complete UI.
    async refresh(options?: { force?: boolean }) {
      if (!this.userId) return;
      if (
        !options?.force &&
        (this.completingQuestIds.length > 0 || this.completingRecurringIds.length > 0)
      ) {
        return;
      }
      if (questsRefreshInflight) return questsRefreshInflight;

      this.loading = true;
      questsRefreshInflight = (async () => {
        try {
          const [quests, recurring] = await Promise.all([
            client.api.quests
              .$get({ query: { status: 'active', include: 'subTasks', includeDoneToday: 'true' } })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
            client.api['recurring-quests']
              .$get()
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
          ]);
          // Keep the painted snapshot if the network failed — don't wipe to empty.
          if (quests == null && recurring == null) return;
          if (quests != null) {
            const all = quests as Quest[];
            this.activeQuests = all.filter((q) => q.status === 'active');
            this.doneTodayQuests = all.filter((q) => q.status === 'completed');
          }
          if (recurring != null) {
            this.recurringQuests = recurring as RecurringQuestWithStreak[];
          }
          this.loaded = true;
          this.loadedDate = localDateString();
          this.fetchedAt = Date.now();
          this.persist();
        } finally {
          this.loading = false;
          questsRefreshInflight = null;
        }
      })();

      return questsRefreshInflight;
    },

    // ── One-off quests ──────────────────────────────────────────────────────
    // Remove a quest id from the active list whether it's a top-level row OR nested as a
    // sub-task under its parent. Sub-tasks live only inside their parent's `subTasks` array
    // (the list drops `parentId != null` top-level rows), so a top-level filter alone would
    // leave a just-completed / deleted sub-task on screen. Shared by applyCompleted/removeQuest.
    dropQuestFromLists(id: string) {
      this.activeQuests = this.activeQuests
        .filter((q) => q.id !== id)
        .map((q) => {
          const subTasks = q.subTasks;
          if (!subTasks?.some((st) => st.id === id)) return q;
          return { ...q, subTasks: subTasks.filter((st) => st.id !== id) };
        });
    },
    addQuest(result: QuestWithWarnings) {
      const quest = result.quest;
      if (quest.parentId != null) {
        // A new sub-task is never a top-level row: the list drops `parentId != null` and
        // renders sub-tasks only nested under their parent's QuestCard. So fold it into the
        // parent's `subTasks` instead of prepending it flat — otherwise it stays invisible
        // until the next refetch rebuilds the nesting.
        this.activeQuests = this.activeQuests.map((q) =>
          q.id === quest.parentId ? { ...q, subTasks: [...(q.subTasks ?? []), quest] } : q,
        );
      } else {
        this.activeQuests = [quest, ...this.activeQuests];
      }
      // A new quest may pin tags (or the quick-add none) — either way a usageCount moved, so
      // the tag counts on Status must refetch next time it opens.
      useTagsStore().invalidate();
      useFeedbackStore().showWarnings(result.warnings);
      this.persist();
    },
    // Completion: drop from the active list, apply server-authoritative player state,
    // and surface a level-up. Pages then sync their own view state (close detail).
    // Dropping a top-level parent also removes its nested sub-tasks, which the backend has
    // just cascade-completed — so the just-closed children leave the board with it, and the
    // enriched player state already includes their XP.
    applyCompleted(result: CompleteResult) {
      // Note: no tags invalidate() here. Completing (and its sub-task cascade) keeps the
      // quest rows and their tag pins in the DB — it only drops them from the *active* list
      // client-side — so usageCount (all quests, any status) is unchanged. Deliberate: see
      // the usageCount semantics note in stores/tags.ts.
      //
      // Before dropping it, snapshot the live entity into the DONE TODAY strip. The store
      // already holds it in full (tags, sub-tasks, description, priority, deadline), so the
      // read-only preview needs no refetch. Top-level only — a sub-task completed on its own
      // stays nested under its still-active parent, matching the backend's doneToday query.
      // Idempotent by construction: once dropped, a repeat call won't find it to re-add.
      const live = this.activeQuests.find((q) => q.id === result.quest.id);
      if (live && live.parentId == null) {
        const completedAt = result.quest.completedAt ?? live.completedAt;
        this.doneTodayQuests = [
          {
            ...live,
            status: 'completed' as const,
            completedAt,
            // The cascade closed the active direct sub-tasks in the same transaction; reflect
            // that so the preview shows them done, matching what the backend just stored.
            subTasks: live.subTasks?.map((st) =>
              st.status === 'active' ? { ...st, status: 'completed' as const, completedAt } : st,
            ),
          },
          ...this.doneTodayQuests,
        ];
      }
      this.dropQuestFromLists(result.quest.id);
      const player = usePlayerStore();
      player.applyProgress(result.player);
      const feedback = useFeedbackStore();
      // Distinct toast slot from the level-up, so a cascade that also levels up shows both
      // without one clobbering the other, and never duplicates the level-up notice.
      if (result.leveledUp) {
        feedback.showLevelUp({
          level: result.player.level,
          xpGain: player.lastXpGain,
          xpForNext: player.xpForNext,
        });
      }
      if (result.cascadedCompletions > 0) {
        const n = result.cascadedCompletions;
        feedback.showInfo(`Completed with ${n} sub-task${n === 1 ? '' : 's'}.`);
      }
      this.persist();
    },
    removeQuest(id: string) {
      this.dropQuestFromLists(id);
      // Deleting a quest cascade-removes its tag pins, dropping those tags' usageCount.
      useTagsStore().invalidate();
      this.persist();
    },
    applyUpdated(result: QuestWithWarnings) {
      const updated = result.quest;
      this.activeQuests = this.activeQuests.map((q) => {
        // Top-level match: merge so nested subTasks (absent from the PATCH response) survive.
        if (q.id === updated.id) return { ...q, ...updated };
        // Nested match: a sub-task edited from the list lives inside its parent's subTasks,
        // so patch it there too — otherwise the row wouldn't reflect the edit until refetch.
        const subTasks = q.subTasks;
        if (!subTasks?.some((st) => st.id === updated.id)) return q;
        return {
          ...q,
          subTasks: subTasks.map((st) => (st.id === updated.id ? { ...st, ...updated } : st)),
        };
      });
      // An edit may have changed the quest's tag set (replace semantics), moving counts.
      useTagsStore().invalidate();
      useFeedbackStore().showWarnings(result.warnings);
      this.persist();
    },

    // ── Tags on quests ──────────────────────────────────────────────────────
    // Keep the tag chips on already-loaded quest cards in step with tag rename/recolour/delete
    // on the Status screen, without a full refetch. Each walks the top-level rows and their
    // nested sub-tasks (the two places a quest's `tags` array lives in the cache).
    renameTagEverywhere(id: string, name: string) {
      const patch = (tags: Quest['tags']) =>
        tags?.map((t) => (t.id === id ? { ...t, name } : t));
      this.mapQuestTags(patch);
    },
    recolorTagEverywhere(id: string, color: TagColor) {
      const patch = (tags: Quest['tags']) =>
        tags?.map((t) => (t.id === id ? { ...t, color } : t));
      this.mapQuestTags(patch);
    },
    removeTagEverywhere(id: string) {
      const strip = (tags: Quest['tags']) => tags?.filter((t) => t.id !== id);
      this.mapQuestTags(strip);
    },
    // Apply a tags transform to every quest and its sub-tasks. Shared by the three above so
    // the top-level + nested walk lives in one place.
    mapQuestTags(fn: (tags: Quest['tags']) => Quest['tags']) {
      this.activeQuests = this.activeQuests.map((q) => ({
        ...q,
        tags: fn(q.tags),
        ...(q.subTasks ? { subTasks: q.subTasks.map((st) => ({ ...st, tags: fn(st.tags) })) } : {}),
      }));
      this.persist();
    },

    // ── Recurring quests ────────────────────────────────────────────────────
    applyRecurringCompleted(result: RecurringCompleteResult) {
      const player = usePlayerStore();
      player.applyProgress(result.player);
      if (result.leveledUp) {
        useFeedbackStore().showLevelUp({
          level: result.player.level,
          xpGain: player.lastXpGain,
          xpForNext: player.xpForNext,
        });
      }
      // Mark done-for-today and fold in the refreshed streak counters (the /complete
      // payload carries only the three counters, not the whole streak row).
      this.recurringQuests = this.recurringQuests.map((rq) =>
        rq.id === result.completion.recurringQuestId
          ? {
              ...rq,
              streak: rq.streak ? { ...rq.streak, ...result.streak } : rq.streak,
              isCompletedToday: true,
            }
          : rq,
      );
      this.persist();
    },
    // A backfilled *past* day: fold in the refreshed streak counters and player XP, but —
    // unlike applyRecurringCompleted — leave isCompletedToday alone. Backfill only ever
    // targets a missed earlier day (today is never "missed"), so today's flag is untouched.
    applyRecurringBackfilled(result: RecurringCompleteResult) {
      const player = usePlayerStore();
      player.applyProgress(result.player);
      if (result.leveledUp) {
        useFeedbackStore().showLevelUp({
          level: result.player.level,
          xpGain: player.lastXpGain,
          xpForNext: player.xpForNext,
        });
      }
      this.recurringQuests = this.recurringQuests.map((rq) =>
        rq.id === result.completion.recurringQuestId
          ? { ...rq, streak: rq.streak ? { ...rq.streak, ...result.streak } : rq.streak }
          : rq,
      );
      this.persist();
    },
    removeRecurring(id: string) {
      this.recurringQuests = this.recurringQuests.filter((rq) => rq.id !== id);
      this.persist();
    },
    applyRecurringUpdated(quest: RecurringQuest) {
      // Bare row from PATCH — merge over the existing entry so streak/today flags survive.
      this.recurringQuests = this.recurringQuests.map((rq) =>
        rq.id === quest.id ? { ...rq, ...quest } : rq,
      );
      this.persist();
    },
    // The create response is just the bare quest (no timezone-derived today flags or
    // streak relation), so we refetch rather than fabricate those client-side.
    async refreshRecurring() {
      const res = await client.api['recurring-quests'].$get();
      if (res.ok) {
        this.recurringQuests = await res.json();
        this.persist();
      }
    },
  },
});
