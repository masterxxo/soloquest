import { defineStore } from 'pinia';
import type { Achievement } from '~/lib/api-client';

// Global, transient "System"-style feedback (level-ups, rank warnings, achievements).
// Lives in a store so it can be triggered from anywhere a quest is completed (any page)
// and rendered once, above the persistent grimoire frame, by the default layout.
interface FeedbackState {
  levelUpTo: number | null;
  warnings: string[];
  achievements: Achievement[] | null;
}

// Timers kept outside reactive state — they're plain handles, not UI data.
let levelUpTimer: ReturnType<typeof setTimeout> | null = null;
let warningsTimer: ReturnType<typeof setTimeout> | null = null;
let achievementsTimer: ReturnType<typeof setTimeout> | null = null;

export const useFeedbackStore = defineStore('feedback', {
  state: (): FeedbackState => ({ levelUpTo: null, warnings: [], achievements: null }),
  actions: {
    showLevelUp(level: number) {
      this.levelUpTo = level;
      if (levelUpTimer) clearTimeout(levelUpTimer);
      levelUpTimer = setTimeout(() => { this.levelUpTo = null; }, 3500);
    },
    showWarnings(warnings: string[]) {
      if (!warnings.length) return;
      this.warnings = warnings;
      if (warningsTimer) clearTimeout(warningsTimer);
      warningsTimer = setTimeout(() => { this.warnings = []; }, 4000);
    },
    showAchievements(achievements: Achievement[]) {
      if (!achievements.length) return;
      this.achievements = achievements;
      if (achievementsTimer) clearTimeout(achievementsTimer);
      achievementsTimer = setTimeout(() => { this.achievements = null; }, 5000);
    },
  },
});
