// Achievement ladders for the Status screen. There is no read endpoint for achievements
// (they only arrive on the completion payload), so the unlocked/pending state is derived
// client-side from data the app already loads: each ritual's streak. This mirrors the
// backend's award rule exactly — a streak achievement fires when a ritual's streak reaches
// the threshold, a total achievement when its lifetime completions do — so "best across all
// rituals ≥ threshold" is the same set the server would have awarded.
//
// The thresholds duplicate the backend seed (apps/api/src/seed/achievements.ts). They are a
// closed, stable list; the frontend can't import from the API package, so they live here.

export const STREAK_ACHIEVEMENT_THRESHOLDS = [5, 10, 25, 50, 100, 250, 365] as const;
export const TOTAL_ACHIEVEMENT_THRESHOLDS = [25, 75, 150, 300, 500, 750, 1000] as const;

export interface AchievementChip {
  threshold: number;
  unlocked: boolean;
}

// A chip is unlocked when the best value any ritual has reached clears its threshold. The
// chip carries the threshold only — never an XP figure — because xpBonus is an open decision
// the UI must not settle.
export function achievementLadder(
  thresholds: readonly number[],
  best: number,
): AchievementChip[] {
  return thresholds.map((threshold) => ({ threshold, unlocked: best >= threshold }));
}
