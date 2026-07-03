import { describe, it, expect } from 'vitest';
import { xpForLevel, levelFromTotalXp } from './leveling';

describe('xpForLevel', () => {
  it('follows floor(100 * n^1.5)', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(282);
    expect(xpForLevel(3)).toBe(519);
  });
});

describe('levelFromTotalXp', () => {
  it('starts at level 1 with no XP', () => {
    expect(levelFromTotalXp(0)).toEqual({ level: 1, current: 0, needed: 100 });
  });

  it('stays on a level until its threshold is reached', () => {
    expect(levelFromTotalXp(99).level).toBe(1);
    expect(levelFromTotalXp(281).level).toBe(2);
  });

  it('levels up exactly at the cumulative threshold', () => {
    expect(levelFromTotalXp(100).level).toBe(2); // 100
    expect(levelFromTotalXp(382).level).toBe(3); // 100 + 282
  });

  it('reports current progress and the next requirement', () => {
    expect(levelFromTotalXp(150)).toEqual({ level: 2, current: 50, needed: 282 });
  });
});

// The core of grantXp: leveledUp = level(newTotal) > level(newTotal - amount). Kept as
// pure math here so it is verified without touching a database.
describe('grantXp level transition (core)', () => {
  const leveledUp = (before: number, amount: number) =>
    levelFromTotalXp(before + amount).level > levelFromTotalXp(before).level;

  it('flags a level-up when a grant crosses the threshold', () => {
    expect(leveledUp(90, 10)).toBe(true); // 90 -> 100 crosses into level 2
  });

  it('does not flag a level-up within the same level', () => {
    expect(leveledUp(100, 10)).toBe(false); // 100 -> 110 stays level 2
  });

  it('accumulates XP across successive grants', () => {
    expect(levelFromTotalXp(0 + 100).level).toBe(2);
    expect(levelFromTotalXp(100 + 282).level).toBe(3);
  });
});
