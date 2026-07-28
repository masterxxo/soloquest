<script setup lang="ts">
import { DIFFICULTY_ORDER, type Difficulty } from '@soloquest/shared';

// The shared rank selector — ONE segmented bar (E·D·C·B·A·S), not six rank badges. This is the
// deliberate resolution of the badge/control collision: the RankBadge is data (corner-cut tint +
// border + ink letter), so the selector is a rectangular control with a flat violet selection and
// no per-rank tint. It cannot be mistaken for a badge (see the "rank C" verification note).
//
// Presentational and reusable: the parent owns the semantics. The filter bar passes its lit
// ranks and toggles additively; the quick-add passes a single-element array and treats a toggle
// as "select this one". Either way this only reflects `selected` and emits `toggle`.
defineProps<{
  selected: readonly Difficulty[];
  label?: string;
}>();
const emit = defineEmits<{ toggle: [rank: Difficulty] }>();
</script>

<template>
  <div
    class="inline-flex overflow-hidden border border-dl-grid-line"
    role="group"
    :aria-label="label ?? 'Rank'"
  >
    <button
      v-for="rank in DIFFICULTY_ORDER"
      :key="rank"
      type="button"
      :aria-pressed="selected.includes(rank)"
      class="min-h-dl-touch min-w-[2rem] cursor-pointer border-l border-dl-grid-line px-2 py-1.5 font-dl-mono text-dl-label font-semibold uppercase transition-colors duration-dl-standard ease-dl first:border-l-0 focus-visible:relative focus-visible:z-10 dl-focus-inset md:min-h-0"
      :class="
        selected.includes(rank)
          ? 'bg-dl-violet text-white'
          : 'bg-dl-surface text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink'
      "
      @click="emit('toggle', rank)"
    >
      {{ rank }}
    </button>
  </div>
</template>
