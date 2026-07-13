import { wasRequiredOn } from './recurrence';

/** The only fields the reset rule needs from a recurring quest row. */
export interface ResettableRitual {
  id: string;
  recurrenceType: string;
  recurrenceValue: number | null;
  createdAt: Date;
}

/**
 * Decide which rituals' streaks the daily tick must reset. Pure — the cron does the
 * batched reads and the bulk write, this owns the rule, so it is unit-testable with no DB.
 *
 * A streak is reset when, on `day` (a *closed* day: yesterday in the user's timezone):
 *   - the ritual was required (wasRequiredOn — the same rule the routes use), and
 *   - no completion was recorded for it, and
 *   - its streak is currently running (> 0).
 *
 * That last condition is what keeps the tick idempotent: a second run on the same day
 * finds the affected streaks already at 0 and selects nothing.
 */
export function selectStreaksToReset(params: {
  rituals: readonly ResettableRitual[];
  completedRitualIds: ReadonlySet<string>;
  currentStreaks: ReadonlyMap<string, number>;
  day: Date;
}): string[] {
  const { rituals, completedRitualIds, currentStreaks, day } = params;

  return rituals
    .filter((ritual) => wasRequiredOn(ritual, day))
    .filter((ritual) => !completedRitualIds.has(ritual.id))
    .filter((ritual) => (currentStreaks.get(ritual.id) ?? 0) > 0)
    .map((ritual) => ritual.id);
}
