// Solo Leveling rank colours, E (weakest) → S (strongest). Single source so the list
// card and the detail view stay in sync.
export const RANK_COLORS: Record<string, string> = {
  E: '#8a8f98', D: '#3fbf6f', C: '#2f6bff', B: '#9a5bff', A: '#ff9a3c', S: '#ffcf3c',
};

// Rank colour for a difficulty, with a neutral fallback for anything unmapped.
export function rankColor(difficulty: string): string {
  return RANK_COLORS[difficulty] ?? '#8a8f98';
}
