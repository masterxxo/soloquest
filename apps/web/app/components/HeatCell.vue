<script setup lang="ts">
// One heatmap/pip cell. The state is carried by FORM first (fill / outline / dash / slash /
// plus), so the six states survive greyscale and colour-blindness — hue is only confirmation.
// Shared by the per-ritual heatmap and the card's 7-day preview strip so the vocabulary can't
// drift. `missed` and `not_scheduled` are deliberately different shapes (solid outline + slash
// vs dashed empty), never the same shape in two colours.
export type HeatState =
  | 'done' // solid fill — presence
  | 'missed' // solid outline + slash — a failed obligation
  | 'not_scheduled' // dashed hairline, empty — no obligation existed
  | 'repairable' // dashed violet + plus, wash fill — the only clickable state
  | 'backfilled' // outline, never filled — permanently unlike a day done on the day
  | 'threshold' // done + gold inner border — a streak milestone
  | 'today_pending'; // due, not yet done, not yet late — no plus (not a repair)

const props = withDefaults(defineProps<{ state: HeatState; size?: number }>(), { size: 17 });

const BASE: Record<HeatState, string> = {
  done: 'bg-dl-violet',
  missed: 'border border-dl-magenta',
  not_scheduled: 'border border-dashed border-dl-band-line',
  repairable: 'border border-dashed border-dl-violet bg-dl-violet-wash',
  backfilled: 'border border-dl-violet',
  threshold: 'bg-dl-violet ring-1 ring-inset ring-dl-gold',
  today_pending: 'border border-dl-violet bg-dl-violet-wash',
};
</script>

<template>
  <span
    class="relative inline-block shrink-0 rounded-[2px]"
    :class="BASE[props.state]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <!-- Missed: a diagonal slash through the outline, so the state reads without its hue. -->
    <svg
      v-if="state === 'missed'"
      class="absolute inset-0 h-full w-full text-dl-magenta"
      viewBox="0 0 10 10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1="1.5" y1="8.5" x2="8.5" y2="1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </svg>
    <!-- Repairable: the plus marks the only clickable state. -->
    <span
      v-else-if="state === 'repairable'"
      class="absolute inset-0 grid place-items-center leading-none text-dl-violet"
      :style="{ fontSize: `${Math.round(size * 0.72)}px` }"
      aria-hidden="true"
    >+</span>
  </span>
</template>
