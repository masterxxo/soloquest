<script setup lang="ts">
import type { TimelineDay } from '~/lib/api-client';
import { formatDate } from '~/lib/date';

// Daily-XP bar chart for the Chronicles header. Built by hand (no chart library): each day
// is one flex column whose height is its share of the window's axis peak, read against a
// small Y-axis of gridlines so an absolute height is legible. The backend already returns a
// continuous, zero-filled window, so there are no gaps to reason about here.
const props = defineProps<{ timeline: TimelineDay[] }>();

// Raw window peak (the tallest day's XP). Zero when nothing was earned — the "flat" case,
// handled explicitly below so the chart degrades to an empty baseline instead of /0.
const max = computed(() => Math.max(0, ...props.timeline.map((d) => d.xp)));
const hasData = computed(() => max.value > 0);

// Round the peak up to a "nice" number so the axis top is a clean label (e.g. 210 -> 250)
// and bars gain a little headroom for their count labels. Returns 0 for an empty window.
function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Bars and gridlines both scale to this, not to the raw peak, so the tallest bar sits just
// under the top gridline instead of pinned at 100%.
const axisMax = computed(() => niceCeil(max.value));

interface Tick {
  value: number;
  pct: number; // distance from the baseline, as a % of plot height
}

// Three gridlines: baseline, midpoint, top. Rounded to integers because XP is whole and a
// half-XP tick would read as noise.
const ticks = computed<Tick[]>(() => {
  if (axisMax.value <= 0) return [];
  return [0, 0.5, 1].map((frac) => ({
    value: Math.round(axisMax.value * frac),
    pct: frac * 100,
  }));
});

// A short 'MMM D' label for a 'YYYY-MM-DD' string, parsed in local time (midday avoids any
// DST edge). Used for the axis ends and the per-bar tooltip.
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return formatDate(new Date(y!, m! - 1, d!, 12), { month: 'short', day: 'numeric' });
}

interface Bar {
  date: string;
  count: number;
  heightPct: number;
  title: string;
}

const bars = computed<Bar[]>(() =>
  props.timeline.map((day) => ({
    date: day.date,
    count: day.count,
    // A day with any XP gets a visible floor (6%) so a 10-XP day next to a 500-XP day
    // doesn't vanish; zero stays zero.
    heightPct:
      hasData.value && day.xp > 0 ? Math.max((day.xp / axisMax.value) * 100, 6) : 0,
    title: `${dayLabel(day.date)} · ${day.count} ${day.count === 1 ? 'quest' : 'quests'} · ${day.xp} XP`,
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

    <!-- Plot: a fixed-width Y-axis gutter (tick labels) beside the bars. Both share the same
         height so labels line up with their gridlines. -->
    <div class="flex gap-2">
      <!-- Y-axis gutter. Each label is bottom-anchored at its gridline's height. -->
      <div v-if="hasData" class="relative h-28 w-8 shrink-0">
        <span
          v-for="tick in ticks"
          :key="tick.value"
          class="absolute right-0 translate-y-1/2 text-[0.6rem] leading-none text-ink-dim"
          :style="{ bottom: tick.pct + '%' }"
        >{{ tick.value }}</span>
      </div>

      <!-- `relative` hosts both the gridlines (behind) and the flat-case overlay. -->
      <div class="relative flex-1 rounded-[6px] border border-line bg-[rgba(14,9,30,0.5)] p-3">
        <!-- Gridlines: subtle horizontal rules the bars are read against. -->
        <div v-if="hasData" class="pointer-events-none absolute inset-3">
          <div
            v-for="tick in ticks"
            :key="tick.value"
            class="absolute inset-x-0 border-t border-line/60"
            :style="{ bottom: tick.pct + '%' }"
          />
        </div>

        <div class="relative flex h-28 items-end gap-[2px]">
          <!-- Each column bottom-aligns its bar and floats the completion count just above
               it, so the number rides the bar's top instead of hiding in a tooltip only. -->
          <div
            v-for="bar in bars"
            :key="bar.date"
            class="flex flex-1 flex-col justify-end self-stretch"
            :title="bar.title"
          >
            <span
              v-if="bar.count > 0"
              class="mb-0.5 text-center text-[0.55rem] leading-none tabular-nums text-ink-dim"
            >{{ bar.count }}</span>
            <div
              class="w-full rounded-t-[2px] bg-accent/80 transition-[height] duration-300"
              :style="{ height: bar.heightPct + '%' }"
            />
          </div>
        </div>

        <div
          v-if="!hasData"
          class="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.8rem] text-line-soft"
        >
          No XP earned in this window yet.
        </div>
      </div>
    </div>

    <!-- Date axis, indented to clear the Y-axis gutter so the ends sit under the bars. -->
    <div class="flex justify-between text-[0.65rem] text-ink-dim" :class="hasData ? 'pl-10' : ''">
      <span>{{ firstLabel }}</span>
      <span>{{ lastLabel }}</span>
    </div>
  </div>
</template>
