import { useFeedbackStore } from '~/stores/feedback';

// DEV-ONLY manual triggers for the rank-up RewardPanel. Rank thresholds are not defined, so nothing
// fires a promotion for real (see detectRankPromotion in lib/ranks.ts) — these are the only way to
// see the animation until the domain lands. Stripped from production by the import.meta.dev guard.
//
// From the browser console:
//   rankUp()            → normal promotion, A from B (2 brackets, 4s)
//   rankUp('B', 'C')    → normal promotion, any bands
//   rankUpS()           → S rank, A → S (3 brackets, 5s, screen inversion)
export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return;
  const feedback = useFeedbackStore();

  const rankUp = (rank = 'A', from = 'B') => feedback.showRankUp({ rank, from });
  const rankUpS = () => rankUp('S', 'A');

  Object.assign(window as typeof window & { rankUp?: typeof rankUp; rankUpS?: typeof rankUpS }, {
    rankUp,
    rankUpS,
  });
});
