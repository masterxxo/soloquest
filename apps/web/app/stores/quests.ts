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
import { localDateString } from '~/lib/date';

// Single client-side cache for the per-user lists. It outlives individual pages (the
// persistent grimoire layout + several routes all read the same arrays), and applies
// the server-authoritative results of mutations straight from their responses.
//
// View/modal state (selected quest, form toggles) stays local to the page — only the
// shared lists and their mutations live here.
interface QuestsState {
  activeQuests: Quest[];
  recurringQuests: RecurringQuestWithStreak[];
  loaded: boolean;
  // Local calendar day the lists were last fetched on (YYYY-MM-DD). The server-computed
  // day-sensitive flags (isCompletedToday / isDueToday, overdue) are only valid for the
  // day they were fetched, so we track this to invalidate the cache across midnight.
  loadedDate: string | null;
}

export const useQuestsStore = defineStore('quests', {
  state: (): QuestsState => ({
    activeQuests: [],
    recurringQuests: [],
    loaded: false,
    loadedDate: null,
  }),
  actions: {
    // Fetch both per-user lists. Pages call this on mount; the cache keeps navigation
    // between pages from refetching — EXCEPT once the local calendar day has changed
    // since the last load, since the day-sensitive flags (done/due today, overdue) go
    // stale when the tab is left open across midnight. Always fetched client-side
    // (per-user, behind login — no SSR benefit, avoids the session-fetch baseURL quirks).
    async load() {
      const today = localDateString();
      if (this.loaded && this.loadedDate === today) return;
      const [quests, recurring] = await Promise.all([
        client.api.quests
          .$get({ query: { status: 'active', include: 'subTasks' } })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        client.api['recurring-quests']
          .$get()
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);
      this.activeQuests = quests as Quest[];
      this.recurringQuests = recurring as RecurringQuestWithStreak[];
      this.loaded = true;
      this.loadedDate = today;
    },

    // ── One-off quests ──────────────────────────────────────────────────────
    addQuest(result: QuestWithWarnings) {
      this.activeQuests = [result.quest, ...this.activeQuests];
      useFeedbackStore().showWarnings(result.warnings);
    },
    // Completion: drop from the active list, apply server-authoritative player state,
    // and surface a level-up. Pages then sync their own view state (close detail).
    applyCompleted(result: CompleteResult) {
      this.activeQuests = this.activeQuests.filter((q) => q.id !== result.quest.id);
      const player = usePlayerStore();
      player.applyProgress(result.player);
      if (result.leveledUp) useFeedbackStore().showLevelUp(result.player.level);
    },
    removeQuest(id: string) {
      this.activeQuests = this.activeQuests.filter((q) => q.id !== id);
    },
    applyUpdated(result: QuestWithWarnings) {
      // Merge so nested subTasks (absent from the PATCH response) are preserved.
      this.activeQuests = this.activeQuests.map((q) =>
        q.id === result.quest.id ? { ...q, ...result.quest } : q,
      );
      useFeedbackStore().showWarnings(result.warnings);
    },

    // ── Recurring quests ────────────────────────────────────────────────────
    applyRecurringCompleted(result: RecurringCompleteResult) {
      const player = usePlayerStore();
      player.applyProgress(result.player);
      if (result.leveledUp) useFeedbackStore().showLevelUp(result.player.level);
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
    },
    removeRecurring(id: string) {
      this.recurringQuests = this.recurringQuests.filter((rq) => rq.id !== id);
    },
    applyRecurringUpdated(quest: RecurringQuest) {
      // Bare row from PATCH — merge over the existing entry so streak/today flags survive.
      this.recurringQuests = this.recurringQuests.map((rq) =>
        rq.id === quest.id ? { ...rq, ...quest } : rq,
      );
    },
    // The create response is just the bare quest (no timezone-derived today flags or
    // streak relation), so we refetch rather than fabricate those client-side.
    async refreshRecurring() {
      const res = await client.api['recurring-quests'].$get();
      if (res.ok) this.recurringQuests = await res.json();
    },
  },
});
