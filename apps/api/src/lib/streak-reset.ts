import { wasRequiredOn } from './recurrence';

/** The only fields the reset rule needs from a recurring quest row. */
export interface ResettableRecurringQuest {
  id: string;
  recurrenceType: string;
  recurrenceValue: number | null;
  createdAt: Date;
}

/**
 * Decide which recurring quests' streaks the daily tick must reset. Pure — the cron does
 * the batched reads and the bulk write, this owns the rule, so it is unit-testable with no DB.
 *
 * A streak is reset when, on `day` (a *closed* day: yesterday in the user's timezone):
 *   - the quest was required (wasRequiredOn — the same rule the routes use), and
 *   - no completion was recorded for it, and
 *   - its streak is currently running (> 0).
 *
 * That last condition is what keeps the tick idempotent: a second run on the same day
 * finds the affected streaks already at 0 and selects nothing.
 */
export function selectStreaksToReset(params: {
  recurringQuests: readonly ResettableRecurringQuest[];
  completedRecurringQuestIds: ReadonlySet<string>;
  currentStreaks: ReadonlyMap<string, number>;
  day: Date;
}): string[] {
  const { recurringQuests, completedRecurringQuestIds, currentStreaks, day } = params;

  return recurringQuests
    .filter((quest) => wasRequiredOn(quest, day))
    .filter((quest) => !completedRecurringQuestIds.has(quest.id))
    .filter((quest) => (currentStreaks.get(quest.id) ?? 0) > 0)
    .map((quest) => quest.id);
}
