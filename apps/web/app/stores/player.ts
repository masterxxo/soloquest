import { defineStore } from 'pinia';
import { levelFromTotalXp, xpForLevel } from '@soloquest/shared';
import { useQuestsStore } from '~/stores/quests';
import { refreshAuthSession } from '~/composables/useAuthSession';
import { bucketByDeadline, localDateString } from '~/lib/date';

// Projection of session.user — the session stays the source of truth. hydrate() runs
// from the session; applyProgress() applies the server-authoritative result of
// completing a quest. This store stays the single source of player state in the UI.
interface PlayerState {
  name: string | null;
  xp: number;
  level: number;
  // Display-only: the size of the most recent XP increase, so the level-up panel can show
  // "+X XP". Not part of the XP/level math — purely a projection for feedback.
  lastXpGain: number;
}

// Cosmetic hunter rank derived from level — purely presentational (the server has no
// player-rank concept; quest difficulty is separate). Single source for the
// letter shown in the kartusz portrait badge.
function rankForLevel(level: number): string {
  if (level >= 50) return 'S';
  if (level >= 35) return 'A';
  if (level >= 20) return 'B';
  if (level >= 10) return 'C';
  if (level >= 5) return 'D';
  return 'E';
}

export const usePlayerStore = defineStore('player', {
  state: (): PlayerState => ({ name: null, xp: 0, level: 1, lastXpGain: 0 }),
  getters: {
    // Level + in-level progress derived from total XP via the shared curve.
    progress: (state) => levelFromTotalXp(state.xp), // { level, current, needed }

    // XP needed to clear the current level (shared curve — single source of truth).
    xpForNext: (state) => xpForLevel(levelFromTotalXp(state.xp).level),

    // In-level fill for the XP bar, clamped to [0, 100].
    xpPct: (state) => {
      const { current, needed } = levelFromTotalXp(state.xp);
      if (!needed) return 0;
      return Math.min(100, Math.max(0, (current / needed) * 100));
    },

    // Cosmetic rank letter shown in the portrait badge.
    rank: (state) => rankForLevel(state.level),

    // Top-level active quests whose deadline is today (the "today" counter).
    todayCount(): number {
      const topLevel = useQuestsStore().activeQuests.filter((q) => q.parentId == null);
      return bucketByDeadline(topLevel).dated.get(localDateString())?.length ?? 0;
    },

    // Top-level active quests whose deadline is before today (kartusz "OVERDUE" counter).
    overdueCount(): number {
      const topLevel = useQuestsStore().activeQuests.filter((q) => q.parentId == null);
      return bucketByDeadline(topLevel).overdue.length;
    },
  },
  actions: {
    hydrate(user: { name?: string | null; xp?: number; level?: number } | null | undefined) {
      this.name = user?.name ?? null;
      this.xp = user?.xp ?? 0;
      this.level = user?.level ?? 1;
    },
    // Server-authoritative xp/level from the /complete response — no XP math here.
    // `lastXpGain` records the size of a real increase; when the same result is applied a
    // second time (the 4a animated path applies at `granted`, then again at drop) the xp is
    // unchanged, so the gain is preserved rather than reset to 0.
    applyProgress(p: { xp: number; level: number }) {
      if (p.xp !== this.xp) this.lastXpGain = p.xp - this.xp;
      this.xp = p.xp;
      this.level = p.level;
    },
    // Re-pull xp/level when the client knows its copy may be stale but got no fresh one
    // in the response — the 409 path: that completion's XP was granted to the account
    // elsewhere (second tab, another device, a raced request). Refetching the cached
    // session updates the shared useFetch data the layout watches, which re-runs
    // hydrate() with the server's values. One refresh path, no XP math on the client.
    //
    // Deliberately silent: it can raise the level, but the level-up toast belongs to the
    // completion that actually earned it, not to the conflict that discovered it.
    // Relies on Better Auth session hitting the DB on every fetch.
    // Enabling session.cookieCache would serve stale xp/level here.
    async refreshFromSession() {
      await refreshAuthSession();
    },
  },
});
