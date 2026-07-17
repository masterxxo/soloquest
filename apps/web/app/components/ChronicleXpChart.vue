<script setup lang="ts">
import type { TimelineDay } from '~/lib/api-client';
import { formatDate } from '~/lib/date';

// Daily-XP bar chart for the Chronicles header. Built by hand (no chart library): each day
// is one flex column whose height is its share of the window's peak. The backend already
// returns a continuous, zero-filled window, so there are no gaps to reason about here.
const props = defineProps<{ timeline: TimelineDay[] }>();

// Window peak. Zero when nothing was earned — the "flat" case, handled explicitly below so
// the chart degrades to an empty baseline instead of dividing by zero.
const max = computed(() => Math.max(0, ...props.timeline.map((d) => d.xp)));
const hasData = computed(() => max.value > 0);

// A short 'MMM D' label for a 'YYYY-MM-DD' string, parsed in local time (midday avoids any
// DST edge). Used for the axis ends and the per-bar tooltip.
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return formatDate(new Date(y!, m! - 1, d!, 12), { month: 'short', day: 'numeric' });
}

interface Bar {
  date: string;
  xp: number;
  heightPct: number;
  title: string;
}

const bars = computed<Bar[]>(() =>
  props.timeline.map((day) => ({
    date: day.date,
    xp: day.xp,
    // A day with any XP gets a visible floor (6%) so a 10-XP day next to a 500-XP day
    // doesn't vanish; zero stays zero.
    heightPct: hasData.value && day.xp > 0 ? Math.max((day.xp / max.value) * 100, 6) : 0,
    title: `${dayLabel(day.date)} · ${day.xp} XP`,
  })),
);

const firstLabel = computed(() =>
  props.timeline.length ? dayLabel(props.timeline[0]!.date) : '',
);
const lastLabel = computed(() =>
  props.timeline.length ? dayLabel(props.timeline[props.timeline.length - 1]!.date) : '',
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between text-[0.7rem] uppercase tracking-[0.18em] text-[#6a5da0]">
      <span>Last 30 days</span>
      <span v-if="hasData" class="tracking-normal text-ink-dim">peak {{ max }} XP</span>
    </div>

    <!-- Plot area: a fixed-height track the bars grow up from. `relative` hosts the flat-case
         overlay so the empty state reads clearly instead of a bare baseline. -->
    <div class="relative rounded-[6px] border border-line bg-[rgba(14,9,30,0.5)] p-3">
      <div class="flex h-28 items-end gap-[2px]">
        <div
          v-for="bar in bars"
          :key="bar.date"
          class="flex-1 self-stretch"
          :title="bar.title"
        >
          <!-- Inner wrapper is full-height and bottom-aligned so each bar rises from the axis. -->
          <div class="flex h-full items-end">
            <div
              class="w-full rounded-t-[2px] bg-accent/80 transition-[height] duration-300"
              :style="{ height: bar.heightPct + '%' }"
            />
          </div>
        </div>
      </div>

      <div
        v-if="!hasData"
        class="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.8rem] text-line-soft"
      >
        No XP earned in this window yet.
      </div>
    </div>

    <div class="flex justify-between text-[0.65rem] text-ink-dim">
      <span>{{ firstLabel }}</span>
      <span>{{ lastLabel }}</span>
    </div>
  </div>
</template>
