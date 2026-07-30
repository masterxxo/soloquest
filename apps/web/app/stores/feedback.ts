import { defineStore } from 'pinia';
import type { Achievement } from '~/lib/api-client';

// Global, transient "System" feedback. Two independent channels, both rendered once at the
// app root (see app.vue) so any page that completes a quest can trigger them:
//
//   • Reward MOMENTS (level up / rank up) — a RewardPanel overlay (4c-1 / 4c-2). Owns its own
//     hold + close, so there is no timer here; the panel calls dismissLevelUp/dismissRankUp.
//   • TOASTS (4c-3) — a bottom-right stack (above the mobile nav) of short-lived cards. Three
//     types, each auto-dismissing with its own progress bar, none with an action button:
//       - achievement  ink + gold; shows the milestone THRESHOLD, never an XP figure — 5s
//       - notice       paper + violet; neutral system facts / rank advisories          — 4s
//       - error        paper + magenta; a request that failed                          — 4s
//     Several can be live at once (one completion can unlock multiple achievements); each
//     carries its own timer and countdown, and a batch that lands together enters staggered.

export type ToastType = 'achievement' | 'notice' | 'error';

interface ToastCommon {
  id: number;
  hold: number; // ms on screen; also the progress-bar duration
  enterDelay: number; // entrance stagger when a batch lands together (ms)
}
export interface AchievementToast extends ToastCommon {
  type: 'achievement';
  // The milestone reached — streak days or lifetime completions. This is the achievement's
  // IDENTITY, not its reward: the toast shows it and never an XP figure (xpBonus is a
  // deliberately open decision the UI must not settle).
  threshold: number;
  title: string;
  description: string | null;
}
export interface MessageToast extends ToastCommon {
  type: 'notice' | 'error';
  message: string;
}
export type Toast = AchievementToast | MessageToast;

// A toast being pushed, before the store stamps its id + entrance stagger.
type NewToast = Omit<AchievementToast, 'id' | 'enterDelay'> | Omit<MessageToast, 'id' | 'enterDelay'>;

// A snapshot of a level-up, frozen at the moment it fired (so a later completion can't mutate
// the "+X XP" the panel is showing). The RewardPanel owns its own hold + close — no timer here.
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

const ACHIEVEMENT_HOLD = 5000;
const MESSAGE_HOLD = 4000;
const STAGGER_MS = 120;

// Per-toast auto-dismiss timers kept outside reactive state — plain handles, not UI data.
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 0;

interface FeedbackState {
  levelUp: LevelUp | null;
  rankUp: RankUp | null;
  toasts: Toast[];
}

export const useFeedbackStore = defineStore('feedback', {
  state: (): FeedbackState => ({ levelUp: null, rankUp: null, toasts: [] }),
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

    // Push a batch of toasts: stamp each an id + a staggered entrance delay, and arm its own
    // auto-dismiss timer. A batch shares one hold, so its toasts also leave together.
    pushToasts(items: NewToast[]) {
      items.forEach((item, i) => {
        const id = nextId++;
        this.toasts.push({ ...item, id, enterDelay: i * STAGGER_MS } as Toast);
        timers.set(
          id,
          setTimeout(() => this.dismissToast(id), item.hold),
        );
      });
    },
    dismissToast(id: number) {
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    // Freshly-crossed achievements — one ink+gold toast each, so unlocking several at once
    // shows a stack. No XP: the threshold is the achievement's identity (see AchievementToast).
    showAchievements(achievements: Achievement[]) {
      if (!achievements.length) return;
      this.pushToasts(
        achievements.map((a) => ({
          type: 'achievement' as const,
          threshold: a.threshold,
          title: a.title,
          description: a.description,
          hold: ACHIEVEMENT_HOLD,
        })),
      );
    },
    // A neutral statement of fact (e.g. "already completed today") — never the player's mistake.
    showInfo(message: string) {
      this.pushToasts([{ type: 'notice', message, hold: MESSAGE_HOLD }]);
    },
    // Non-blocking system advisories (e.g. the rank-derivation warning). Rendered as calm
    // notices — there is no separate "warning" toast type; the neutral channel carries them.
    showWarnings(warnings: string[]) {
      if (!warnings.length) return;
      this.pushToasts(warnings.map((message) => ({ type: 'notice' as const, message, hold: MESSAGE_HOLD })));
    },
    // A request that failed. The optimistic update has already been rolled back, so there is
    // nothing to retry from here — the toast just states it and dismisses (no action button).
    showError(message: string) {
      this.pushToasts([{ type: 'error', message, hold: MESSAGE_HOLD }]);
    },
  },
});
