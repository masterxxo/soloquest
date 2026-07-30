// Solo Leveling rank colours, E (weakest) → S (strongest). Single source so the list
// card and the detail view stay in sync.
export const RANK_COLORS: Record<string, string> = {
  E: '#8a8f98', D: '#3fbf6f', C: '#2f6bff', B: '#9a5bff', A: '#ff9a3c', S: '#ffcf3c',
};

// Rank colour for a difficulty, with a neutral fallback for anything unmapped.
export function rankColor(difficulty: string): string {
  return RANK_COLORS[difficulty] ?? '#8a8f98';
}

// Player rank bands, weakest → strongest. The ladder shown under the glyph in the rank-up
// RewardPanel (with the newly reached band highlighted).
export const RANK_LADDER = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

// TODO: RANK THRESHOLDS NOT DEFINED — deliberate stub, do not treat as a working mechanic.
//
// The player's rank is a function of level (see `rankForLevel` in the player store), but the band
// thresholds are NOT domain-confirmed — the layout carries a "rankFromLevel — thresholds not
// finalized" TODO for exactly this reason. So there is no real "crossed a rank threshold" event to
// hang a promotion on. This placeholder takes (oldLevel, newLevel) and ALWAYS reports "no
// promotion" (null) until the thresholds are settled in a separate product thread. The rank-up
// RewardPanel is fully built and manually testable (see the dev-only `window.rankUp` trigger), but
// nothing calls this from the completion flow yet — wiring it in is deliberately deferred so we
// don't ship dead code masquerading as a live feature. When thresholds land, compare the bands and
// return the newly reached rank letter here, then call it where XP is applied.
export function detectRankPromotion(_oldLevel: number, _newLevel: number): string | null {
  return null;
}
