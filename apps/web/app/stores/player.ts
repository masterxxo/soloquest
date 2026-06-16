import { defineStore } from 'pinia';
import { levelFromTotalXp } from '@soloquest/shared';

// Projection of session.user — the session stays the source of truth. hydrate() runs
// from the session; applyProgress() applies the server-authoritative result of
// completing a quest. This store stays the single source of player state in the UI.
interface PlayerState {
  name: string | null;
  xp: number;
  level: number;
}

export const usePlayerStore = defineStore('player', {
  state: (): PlayerState => ({ name: null, xp: 0, level: 1 }),
  getters: {
    // Level + in-level progress derived from total XP via the shared curve.
    progress: (state) => levelFromTotalXp(state.xp), // { level, current, needed }
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
