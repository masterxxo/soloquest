<script setup lang="ts">
import { DIFFICULTY_ORDER, type Difficulty } from '@soloquest/shared';
import { useQuestFilters } from '~/composables/useQuestFilters';
import { rankColor } from '~/lib/ranks';
import { PRIORITY_DISPLAY_ORDER, PRIORITY_STYLES } from '~/lib/priority';

// The rank chips, the tag filter (a searchable popover — see QuestTagFilter), and the
// "Showing X of Y · Clear" readout for the quest list.
//
// The filter state lives in the URL (useRankFilter), so this reads it straight from there
// instead of taking it as props: passing it down would only make a second copy of
// something the address already owns. The two counts are the exception — only the page
// can count its own list — so they come in as props.
const props = defineProps<{
  shown: number;
  total: number;
}>();

const {
  isRankSelected,
  isPrioritySelected,
  togglePriority,
  isCountFiltered,
  isFiltered,
  hideSubTasks,
  toggleRank,
  toggleSubTasks,
  clearFilter,
} = useQuestFilters();

// A lit chip *is* the rank badge from QuestCard (rank colour + glow); an unlit one keeps
// the shape and the letter but falls back to a muted outline via classes, so "off" reads
// at a glance without the colour having to carry the state on its own.
function chipStyle(rank: Difficulty) {
  if (!isRankSelected(rank)) return undefined;
  const color = rankColor(rank);
  return { color, borderColor: color };
}

// One clause per filter the player actually turned on, so "Clear" never sits next to a
// blank reason.
//
// The count is deliberately rank-only. `shown`/`total` both count top-level quests, and
// hiding sub-tasks removes none of them — so with the toggle as the only filter the count
// would read "Showing 5 of 5": true, but it reads like a filter that failed. Rather than
// bend the numbers to look busy (counting sub-tasks into `total` would be inventing a
// denominator the list never had), the toggle states itself in words and leaves the count
// alone.
const summaryParts = computed(() => {
  const parts: string[] = [];
  if (isCountFiltered.value) parts.push(`Showing ${props.shown} of ${props.total}`);
  if (hideSubTasks.value) parts.push('Sub-tasks hidden');
  return parts;
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <div class="flex flex-wrap gap-1" role="group" aria-label="Filter by rank">
      <button
        v-for="rank in DIFFICULTY_ORDER"
        :key="rank"
        type="button"
        :aria-pressed="isRankSelected(rank)"
        class="grid h-7 w-7 cursor-pointer place-items-center rounded-none border bg-panel text-[0.9rem] font-extrabold font-[inherit] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
        :class="isRankSelected(rank) ? '[text-shadow:0_0_8px_currentColor]' : 'border-line text-ink-dim hover:border-line-soft hover:text-ink'"
        :style="chipStyle(rank)"
        @click="toggleRank(rank)"
      >
        {{ rank }}
      </button>
    </div>

    <!-- Priority: glyph chips (▲ ─ ▼), same additive OR semantics as the ranks. Glyphs
         rather than words so three more chips don't turn the bar into a wall of text. The
         divider is glued to the chips (one flex unit) so that when the bar wraps on a narrow
         screen it travels with them instead of stranding a floating rule at a line edge. -->
    <div class="flex items-center gap-2">
      <span class="h-6 w-px flex-none bg-line" aria-hidden="true" />
      <div class="flex flex-wrap gap-1" role="group" aria-label="Filter by priority">
        <button
          v-for="p in PRIORITY_DISPLAY_ORDER"
          :key="p"
          type="button"
          :aria-pressed="isPrioritySelected(p)"
          :aria-label="PRIORITY_STYLES[p].label"
          class="grid h-7 w-7 cursor-pointer place-items-center rounded-none border bg-panel text-[0.9rem] font-[inherit] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
          :class="isPrioritySelected(p) ? [PRIORITY_STYLES[p].klass, 'border-current [text-shadow:0_0_6px_currentColor]'] : 'border-line text-ink-dim hover:border-line-soft hover:text-ink'"
          @click="togglePriority(p)"
        >
          {{ PRIORITY_STYLES[p].glyph }}
        </button>
      </div>
    </div>

    <!-- Tags: OR filter over the quest's pinned tags, in a searchable popover so the bar
         scales past a handful of tags. Selected tags surface as chips beside its button. -->
    <QuestTagFilter />

    <button
      type="button"
      :aria-pressed="hideSubTasks"
      class="cursor-pointer rounded-none border px-[0.6rem] py-[0.3rem] text-[0.75rem] font-semibold font-[inherit] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
      :class="hideSubTasks ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink-dim hover:border-line-soft hover:text-ink'"
      @click="toggleSubTasks"
    >
      Hide sub-tasks
    </button>

    <p v-if="isFiltered" class="m-0 flex items-center gap-2 text-[0.75rem] text-ink-muted">
      {{ summaryParts.join(' · ') }}
      <span aria-hidden="true">·</span>
      <button
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 text-[0.75rem] font-semibold text-accent-light font-[inherit] hover:underline"
        @click="clearFilter"
      >
        Clear
      </button>
    </p>
  </div>
</template>
