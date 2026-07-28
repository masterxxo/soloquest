<script setup lang="ts">
import type { TimelineDay } from '~/lib/api-client';
import { formatDate } from '~/lib/date';

// Completed-quests-per-day chart. The BAR is the count (the primary value, printed above each
// bar in ink so the chart is readable without hover). The XP is a thin cyan RIBBON below the
// axis — a secondary metric at a tenth of the visual weight, on its own scale, never a second
// bar and never a second axis. A zero day keeps its printed 0 and a dashed, unfilled ribbon
// slot. 30 days; on mobile the row scrolls horizontally with today pinned to the right.
const props = defineProps<{ timeline: TimelineDay[] }>();

const maxCount = computed(() => Math.max(0, ...props.timeline.map((d) => d.count)));
const maxXp = computed(() => Math.max(0, ...props.timeline.map((d) => d.xp)));
const hasData = computed(() => maxCount.value > 0);

function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}
const axisMax = computed(() => niceCeil(maxCount.value));

const ticks = computed(() => {
  if (axisMax.value <= 0) return [] as { value: number; pct: number }[];
  return [0, 0.5, 1].map((frac) => ({ value: Math.round(axisMax.value * frac), pct: frac * 100 }));
});

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return formatDate(new Date(y!, m! - 1, d!, 12), { month: 'short', day: 'numeric' });
}

interface Bar {
  date: string;
  count: number;
  xp: number;
  barPct: number;
  ribbonPct: number;
  isMonday: boolean;
}
const bars = computed<Bar[]>(() =>
  props.timeline.map((day) => {
    const [y, m, d] = day.date.split('-').map(Number);
    return {
      date: day.date,
      count: day.count,
      xp: day.xp,
      barPct: axisMax.value > 0 && day.count > 0 ? Math.max((day.count / axisMax.value) * 100, 4) : 0,
      ribbonPct: maxXp.value > 0 && day.xp > 0 ? Math.max((day.xp / maxXp.value) * 100, 12) : 0,
      isMonday: new Date(y!, m! - 1, d!, 12).getDay() === 1,
    };
  }),
);

// Tap-to-read on touch (no hover): the selected day's exact figures show in the readout line.
const selected = ref<Bar | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
onMounted(() => {
  nextTick(() => { if (scrollEl.value) scrollEl.value.scrollLeft = scrollEl.value.scrollWidth; });
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Quests completed per day · last 30 days</span>
      <span class="font-dl-mono text-dl-label text-dl-ink-faint">
        <template v-if="selected">{{ dayLabel(selected.date) }} · {{ selected.count }} {{ selected.count === 1 ? 'quest' : 'quests' }} · {{ selected.xp }} XP</template>
        <template v-else>bar = quests · ribbon = XP</template>
      </span>
    </div>

    <div class="flex gap-2">
      <!-- Count axis gutter -->
      <div v-if="hasData" class="relative h-32 w-6 shrink-0">
        <span
          v-for="tick in ticks"
          :key="tick.value"
          class="absolute right-0 translate-y-1/2 font-dl-mono text-[0.6rem] leading-none text-dl-ink-muted"
          :style="{ bottom: tick.pct + '%' }"
        >{{ tick.value }}</span>
      </div>

      <div ref="scrollEl" class="min-w-0 flex-1 overflow-x-auto">
        <div class="min-w-full">
          <!-- Plot: bars above the axis. -->
          <div class="relative h-32">
            <!-- Gridlines -->
            <div v-if="hasData" class="pointer-events-none absolute inset-0">
              <div v-for="tick in ticks" :key="tick.value" class="absolute inset-x-0 border-t border-dl-hairline" :style="{ bottom: tick.pct + '%' }" />
            </div>
            <div class="relative flex h-full items-end gap-[2px]">
              <button
                v-for="bar in bars"
                :key="bar.date"
                type="button"
                class="flex min-w-[10px] flex-1 cursor-pointer flex-col justify-end self-stretch border-0 bg-transparent p-0"
                :aria-label="`${dayLabel(bar.date)}: ${bar.count} quests, ${bar.xp} XP`"
                @click="selected = bar"
              >
                <span class="mb-0.5 text-center font-dl-mono text-[0.55rem] leading-none tabular-nums text-dl-ink">{{ bar.count }}</span>
                <span class="w-full bg-dl-violet transition-[height] duration-dl-standard" :style="{ height: bar.barPct + '%' }" />
              </button>
            </div>
          </div>

          <!-- Axis line -->
          <div class="h-px w-full bg-dl-band-line" />

          <!-- XP ribbon below the axis -->
          <div class="relative flex h-3 items-start gap-[2px]">
            <div v-for="bar in bars" :key="bar.date" class="flex min-w-[10px] flex-1 items-start justify-stretch">
              <span
                v-if="bar.xp > 0"
                class="w-full bg-dl-cyan"
                :style="{ height: `${Math.max(2, (bar.ribbonPct / 100) * 12)}px` }"
              />
              <span v-else class="h-[2px] w-full border-b border-dashed border-dl-grid-line" />
            </div>
          </div>

          <!-- Date ticks: every Monday + the ends. -->
          <div class="relative mt-1 flex gap-[2px]">
            <div v-for="bar in bars" :key="bar.date" class="min-w-[10px] flex-1 text-center">
              <span v-if="bar.isMonday" class="font-dl-mono text-[0.55rem] leading-none text-dl-ink-muted">{{ dayLabel(bar.date) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!hasData" class="m-0 font-dl-mono text-dl-label text-dl-ink-faint">No quests completed in this window yet.</p>
  </div>
</template>
