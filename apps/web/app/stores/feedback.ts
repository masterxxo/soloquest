import { defineStore } from 'pinia';
import type { Achievement } from '~/lib/api-client';

// Global, transient "System"-style feedback (level-ups, notices, achievements).
// Lives in a store so it can be triggered from anywhere a quest is completed (any page)
// and rendered once, above the persistent grimoire frame, by the default layout.

// A notice is either a warning (something the player should fix — amber) or an info
// message (a neutral statement of fact, e.g. "already completed today" — accent).
export type NoticeVariant = 'warning' | 'info';
export interface Notice {
  messages: string[];
  variant: NoticeVariant;
}

interface FeedbackState {
  levelUpTo: number | null;
  notice: Notice | null;
  achievements: Achievement[] | null;
}

// Timers kept outside reactive state — they're plain handles, not UI data.
let levelUpTimer: ReturnType<typeof setTimeout> | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
let achievementsTimer: ReturnType<typeof setTimeout> | null = null;

export const useFeedbackStore = defineStore('feedback', {
  state: (): FeedbackState => ({ levelUpTo: null, notice: null, achievements: null }),
  actions: {
    showLevelUp(level: number) {
      this.levelUpTo = level;
      if (levelUpTimer) clearTimeout(levelUpTimer);
      levelUpTimer = setTimeout(() => { this.levelUpTo = null; }, 3500);
    },
    // One toast slot for both variants — the latest notice replaces the previous one.
    showNotice(messages: string[], variant: NoticeVariant) {
      if (!messages.length) return;
      this.notice = { messages, variant };
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { this.notice = null; }, 4000);
    },
    showWarnings(warnings: string[]) {
      this.showNotice(warnings, 'warning');
    },
    showInfo(message: string) {
      this.showNotice([message], 'info');
    },
    showAchievements(achievements: Achievement[]) {
      if (!achievements.length) return;
      this.achievements = achievements;
      if (achievementsTimer) clearTimeout(achievementsTimer);
      achievementsTimer = setTimeout(() => { this.achievements = null; }, 5000);
    },
  },
});
