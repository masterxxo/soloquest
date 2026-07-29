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

// A snapshot of a level-up, frozen at the moment it fired (so a later completion can't mutate
// the "+X XP" the panel is showing). The RewardPanel owns its own hold + close, so — unlike the
// notice/achievement toasts — there is no auto-hide timer here; the panel calls dismissLevelUp().
export interface LevelUp {
  level: number;
  xpGain: number;
  xpForNext: number;
}

// A rank promotion, shown by the same RewardPanel. `rank` is the newly reached band, `from` the
// previous one. NOTE: nothing in the completion flow fires this yet — rank thresholds are not
// defined (see detectRankPromotion in lib/ranks.ts); today it is reached only by the dev trigger.
export interface RankUp {
  rank: string;
  from: string;
}

interface FeedbackState {
  levelUp: LevelUp | null;
  rankUp: RankUp | null;
  notice: Notice | null;
  achievements: Achievement[] | null;
}

// Timers kept outside reactive state — they're plain handles, not UI data.
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
let achievementsTimer: ReturnType<typeof setTimeout> | null = null;

export const useFeedbackStore = defineStore('feedback', {
  state: (): FeedbackState => ({ levelUp: null, rankUp: null, notice: null, achievements: null }),
  actions: {
    showLevelUp(payload: LevelUp) {
      this.levelUp = payload;
    },
    dismissLevelUp() {
      this.levelUp = null;
    },
    // Rank promotion. Reached only by the dev trigger for now — see the RankUp note above and the
    // stubbed detectRankPromotion. The RewardPanel owns its own hold + close (no timer here).
    showRankUp(payload: RankUp) {
      this.rankUp = payload;
    },
    dismissRankUp() {
      this.rankUp = null;
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
