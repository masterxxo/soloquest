export const XP_REWARDS = { E: 10, D: 25, C: 50, B: 100, A: 250, S: 500 } as const

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5))
}

export function levelFromTotalXp(totalXp: number): { level: number; current: number; needed: number } {
  let level = 1
  let remaining = totalXp
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  return { level, current: remaining, needed: xpForLevel(level) }
}