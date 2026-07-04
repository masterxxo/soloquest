import type { RecurrenceType } from '@soloquest/shared';

// Front-end presentation helpers for a ritual's recurrence — labels and the weekday
// bitmask UI. NOTE: this is display logic only; the authoritative recurrence rules
// (wasRequiredOn / normalizeRecurrence) live in @soloquest/shared on the backend.

// Weekday labels in bitmask order: bit 0 = Mon … bit 6 = Sun (matches the DB/recurrence doc).
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Decode a weekday bitmask into its selected day labels (bit i ⇔ WEEKDAYS[i]).
export function decodeWeekdays(mask: number): string[] {
  return WEEKDAYS.filter((_, i) => ((mask >> i) & 1) === 1);
}

// Human-readable recurrence summary shown under a ritual's title.
export function recurrenceLabel(quest: {
  recurrenceType: RecurrenceType;
  recurrenceValue: number | null;
}): string {
  if (quest.recurrenceType === 'daily') return 'Every day';
  if (quest.recurrenceType === 'every_x_days') return `Every ${quest.recurrenceValue ?? '?'} days`;
  // weekdays → decode the bitmask back into day abbreviations.
  const days = decodeWeekdays(quest.recurrenceValue ?? 0);
  return days.length ? days.join(', ') : 'No days set';
}
