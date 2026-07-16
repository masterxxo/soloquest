<script setup lang="ts">
import { DIFFICULTY_ORDER, type Difficulty } from '@soloquest/shared';
import { useRankFilter } from '~/composables/useRankFilter';
import { rankColor } from '~/lib/ranks';

// The rank chips and the "Showing X of Y · Clear" readout for the quest list.
//
// The filter state lives in the URL (useRankFilter), so this reads it straight from there
// instead of taking it as props: passing it down would only make a second copy of
// something the address already owns. The two counts are the exception — only the page
// can count its own list — so they come in as props.
defineProps<{
  shown: number;
  total: number;
}>();

const { isRankSelected, isFiltered, toggleRank, clearFilter } = useRankFilter();

// A lit chip *is* the rank badge from QuestCard (rank colour + glow); an unlit one keeps
// the shape and the letter but falls back to a muted outline via classes, so "off" reads
// at a glance without the colour having to carry the state on its own.
function chipStyle(rank: Difficulty) {
  if (!isRankSelected(rank)) return undefined;
  const color = rankColor(rank);
  return { color, borderColor: color };
}
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

    <p v-if="isFiltered" class="m-0 flex items-center gap-2 text-[0.75rem] text-ink-muted">
      Showing {{ shown }} of {{ total }}
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
