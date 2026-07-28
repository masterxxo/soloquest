import { QUEST_PRIORITY, type QuestPriority } from '@soloquest/shared';

// Priority presentation — the single source for the glyph, the accessible label and the
// colour token each priority uses, shared by the card marker, the form's segmented control
// and the filter chips.
//
// A chevron, not another coloured badge: the card already carries a rank badge (coloured
// letter) and coloured tag chips, so priority gets a different FORM to read as a different
// kind of information. `high` uses the warm `gold` warning accent (attention without the red
// that means delete/overdue); `low` uses a dimmed `ink` that recedes. `normal` is the calm
// middle — a plain dash, and on the card it renders NOTHING at all (see priorityMarker).

interface PriorityStyle {
  glyph: string;
  label: string; // full accessible label (glyph alone says nothing to a screen reader)
  short: string; // one word for the segmented control
  klass: string; // Tailwind colour token(s); these are theme tokens, so classes (not :style)
}

export const PRIORITY_STYLES: Record<QuestPriority, PriorityStyle> = {
  high: { glyph: '▲', label: 'High priority', short: 'High', klass: 'text-gold' },
  normal: { glyph: '─', label: 'Normal priority', short: 'Normal', klass: 'text-ink-dim' },
  low: { glyph: '▼', label: 'Low priority', short: 'Low', klass: 'text-ink-dim opacity-60' },
};

// Card/detail marker: high and low only. `normal` returns null so most quests render no
// marker and no reserved space — a "NORMAL" tag on every row would be pure noise.
export function priorityMarker(priority: QuestPriority): PriorityStyle | null {
  return priority === 'normal' ? null : PRIORITY_STYLES[priority];
}

// Daylight colour tokens for the priority glyph — kept SEPARATE from `klass` above, which
// still points at the grimoire tokens the not-yet-migrated QuestCard/QuestForm use. The
// migrated (Daylight) surfaces read this instead so the glyph lands on the light palette.
// `high` keeps the warm gold warning accent; `low`/`normal` recede to a faint ink.
export const PRIORITY_DL_CLASS: Record<QuestPriority, string> = {
  high: 'text-dl-gold',
  normal: 'text-dl-ink-faint',
  low: 'text-dl-ink-faint',
};

// Display order for the form control and the filter chips: high → normal → low (most
// prominent first). The canonical enum order in `@soloquest/shared` stays ascending
// (low, normal, high) for a possible future sort; this is presentation only.
export const PRIORITY_DISPLAY_ORDER: QuestPriority[] = [...QUEST_PRIORITY].reverse();
