import { defineStore } from 'pinia';
import {
  client,
  type Quest,
  type QuestWithWarnings,
  type CompleteResult,
  type Campaign,
  type CampaignRow,
  type RecurringQuest,
  type RecurringQuestWithStreak,
  type RecurringCompleteResult,
} from '~/lib/api-client';
import { usePlayerStore } from '~/stores/player';
import { useFeedbackStore } from '~/stores/feedback';

// Single client-side cache for the per-user lists. It outlives individual pages (the
// persistent grimoire layout + several routes all read the same arrays), and applies
// the server-authoritative results of mutations straight from their responses.
//
// View/modal state (open campaign, selected quest, form toggles) stays local to the
// page — only the shared lists and their mutations live here.
interface QuestsState {
  activeQuests: Quest[];
  campaigns: Campaign[];
  recurringQuests: RecurringQuestWithStreak[];
  loaded: boolean;
}

export const useQuestsStore = defineStore('quests', {
  state: (): QuestsState => ({
    activeQuests: [],
    campaigns: [],
    recurringQuests: [],
    loaded: false,
  }),
  getters: {
    // Map a quest's campaignId to its campaign name for display (badges/labels).
    campaignName: (state) => {
      const byId = new Map(state.campaigns.map((c) => [c.id, c.title]));
      return (id: string | null | undefined): string | null =>
        id ? byId.get(id) ?? null : null;
    },
  },
  actions: {
    // Fetch all three per-user lists once. Pages call this on mount; the flag keeps
    // navigation between pages from refetching. Always fetched client-side (per-user,
    // behind login — no SSR benefit, avoids the session-fetch baseURL quirks).
    async load() {
      if (this.loaded) return;
      const [quests, campaigns, recurring] = await Promise.all([
        client.api.quests
          .$get({ query: { status: 'active', include: 'subTasks' } })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        client.api.campaigns
          .$get()
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        client.api['recurring-quests']
          .$get()
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);
      this.activeQuests = quests as Quest[];
      this.campaigns = campaigns as Campaign[];
      this.recurringQuests = recurring as RecurringQuestWithStreak[];
      this.loaded = true;
    },

    // ── One-off quests ──────────────────────────────────────────────────────
    addQuest(result: QuestWithWarnings) {
      this.activeQuests = [result.quest, ...this.activeQuests];
      useFeedbackStore().showWarnings(result.warnings);
    },
    // Completion: drop from the active list, apply server-authoritative player state,
    // surface a level-up, and mirror the server's campaign auto-transition. Pages then
    // sync their own view state (close detail, drop from an open campaign's list).
    applyCompleted(result: CompleteResult) {
      this.activeQuests = this.activeQuests.filter((q) => q.id !== result.quest.id);
      const player = usePlayerStore();
      player.applyProgress(result.player);
      if (result.leveledUp) useFeedbackStore().showLevelUp(result.player.level);
      this.bumpCampaignToClearing(result.quest.campaignId);
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

    // ── Campaigns ───────────────────────────────────────────────────────────
    addCampaign(created: CampaignRow) {
      // POST returns the row without questCount; a brand-new campaign has 0 quests.
      this.campaigns = [{ ...created, questCount: 0 }, ...this.campaigns];
    },
    updateCampaignRow(updated: CampaignRow) {
      this.campaigns = this.campaigns.map((c) =>
        c.id === updated.id ? { ...c, ...updated } : c,
      );
    },
    // Mirror the server's auto-transition: completing a quest in an untouched (active)
    // campaign moves it to 'clearing'. Applied client-side so the list stays in sync.
    bumpCampaignToClearing(campaignId: string | null | undefined) {
      if (!campaignId) return;
      this.campaigns = this.campaigns.map((c) =>
        c.id === campaignId && c.status === 'active' ? { ...c, status: 'clearing' } : c,
      );
    },
    setCampaignStatus(id: string, patch: Partial<Campaign>) {
      this.campaigns = this.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c));
    },
  },
});
