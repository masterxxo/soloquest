import { defineStore } from 'pinia';
import { levelFromTotalXp, xpForLevel } from '@soloquest/shared';
import { useQuestsStore } from '~/stores/quests';

// Projection of session.user — the session stays the source of truth. hydrate() runs
// from the session; applyProgress() applies the server-authoritative result of
// completing a quest. This store stays the single source of player state in the UI.
interface PlayerState {
  name: string | null;
  xp: number;
  level: number;
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

// Local YYYY-MM-DD key (not toISOString — that would shift by the UTC offset).
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const usePlayerStore = defineStore('player', {
  state: (): PlayerState => ({ name: null, xp: 0, level: 1 }),
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
      const todayKey = dateKey(new Date());
      return useQuestsStore().activeQuests.filter(
        (q) => q.parentId == null && q.deadline && dateKey(new Date(q.deadline)) === todayKey,
      ).length;
    },

    // Top-level active quests whose deadline is before today (kartusz "OVERDUE" counter).
    overdueCount(): number {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return useQuestsStore().activeQuests.filter(
        (q) => q.parentId == null && q.deadline && new Date(q.deadline) < start,
      ).length;
    },
  },
  actions: {
    hydrate(user: { name?: string | null; xp?: number; level?: number } | null | undefined) {
      this.name = user?.name ?? null;
      this.xp = user?.xp ?? 0;
      this.level = user?.level ?? 1;
    },
    // Server-authoritative xp/level from the /complete response — no XP math here.
    applyProgress(p: { xp: number; level: number }) {
      this.xp = p.xp;
      this.level = p.level;
    },
  },
});
