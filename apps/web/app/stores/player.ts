import { defineStore } from 'pinia';
import { xpForLevel } from '@soloquest/shared';

// Projection of session.user — the session stays the source of truth. hydrate()
// is re-called whenever session data changes; this store only adds leveling views.
interface PlayerState {
  name: string | null;
  xp: number;
  level: number;
}

export const usePlayerStore = defineStore('player', {
  state: (): PlayerState => ({ name: null, xp: 0, level: 1 }),
  getters: {
    // XP required to clear the current level (shared leveling curve).
    xpForNextLevel: (state) => xpForLevel(state.level),
    // Progress through the current level, clamped to [0, 1] for the bar.
    levelProgress: (state) => {
      const needed = xpForLevel(state.level);
      return needed > 0 ? Math.min(state.xp / needed, 1) : 0;
    },
  },
  actions: {
    hydrate(user: { name?: string | null; xp?: number; level?: number } | null | undefined) {
      this.name = user?.name ?? null;
      this.xp = user?.xp ?? 0;
      this.level = user?.level ?? 1;
    },
  },
});
