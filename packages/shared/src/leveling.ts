import { DIFFICULTY_ORDER, type Difficulty } from './enums'

export const XP_REWARDS = { E: 10, D: 25, C: 50, B: 100, A: 250, S: 500 } as const

// Flat XP granted for completing a recurring quest, independent of difficulty — the
// value of a habit is in the repetition, not the one-off rank. Single source of truth,
// consumed by the api (granting) and the web (display).
export const RECURRING_XP_REWARD = 10

// >0 when `a` outranks `b`, 0 when equal, <0 when `a` is weaker.
export function compareDifficulty(a: Difficulty, b: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b)
}

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