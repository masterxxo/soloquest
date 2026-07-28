<script setup lang="ts">
import { MAX_BACKFILL_DAYS } from '@soloquest/shared';
import type { RecurringCalendarDay } from '~/lib/api-client';
import type { HeatState } from '~/components/HeatCell.vue';

// Per-ritual completion heatmap. The backend is the source of truth for each day's status
// (done / missed / not_scheduled); this lays days into weekly columns and maps them onto the
// shared HeatCell form vocabulary. Five of the six states are reachable from current data —
// DONE, MISSED, NOT SCHEDULED, REPAIRABLE (missed inside the backfill window) and TODAY
// PENDING (today, due, not yet done). BACKFILLED and THRESHOLD are defined forms in HeatCell
// but need calendar data the /stats contract doesn't carry yet, so they aren't fed here.
const props = defineProps<{
  calendar: RecurringCalendarDay[];
  // Whether today is a due day — lets today's neutral cell read as "pending" rather than
  // "not scheduled" (the calendar can't distinguish them: today is never "missed").
  todayDue?: boolean;
  pendingDate?: string | null;
  disabled?: boolean;
}>();
const emit = defineEmits<{ backfill: [date: string] }>();

type Status = RecurringCalendarDay['status'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['M', '', 'W', '', 'F', '', 'S'];
const CELL = 16;

interface Cell {
  date: string | null;
  status: Status | null;
  isToday: boolean;
}
interface Week {
  cells: Cell[];
  monthLabel: string | null;
}

function parseUtc(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}
function formatUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function mondayOf(date: Date): Date {
  const dow = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - dow * MS_PER_DAY);
}

// Weeks from the window start's Monday up to (and including) today — no future filler, so
// today is the last real column and pins to the right edge on mobile.
const weeks = computed<Week[]>(() => {
  const cal = props.calendar;
  if (!cal.length) return [];
  const statusByDate = new Map<string, Status>(cal.map((d) => [d.date, d.status]));
  const first = parseUtc(cal[0]!.date);
  const todayStr = cal[cal.length - 1]!.date;
  const todayTime = parseUtc(todayStr).getTime();
  const gridStart = mondayOf(first).getTime();
  const totalWeeks = Math.round((mondayOf(parseUtc(todayStr)).getTime() - gridStart) / (7 * MS_PER_DAY)) + 1;

  const result: Week[] = [];
  let cursor = gridStart;
  let prevMonth = -1;
  for (let w = 0; w < totalWeeks; w++) {
    const cells: Cell[] = [];
    let mondayDate: Date | null = null;
    for (let row = 0; row < 7; row++) {
      const dt = new Date(cursor);
      if (row === 0) mondayDate = dt;
      const time = dt.getTime();
      const ds = formatUtc(dt);
      if (time < first.getTime() || time > todayTime) {
        cells.push({ date: null, status: null, isToday: false });
      } else {
        cells.push({ date: ds, status: statusByDate.get(ds) ?? null, isToday: ds === todayStr });
      }
      cursor += MS_PER_DAY;
    }
    const month = mondayDate!.getUTCMonth();
    result.push({ cells, monthLabel: month !== prevMonth ? MONTHS[month]! : null });
    prevMonth = month;
  }
  return result;
});

const lastCalendarDate = computed(() => props.calendar.at(-1)?.date ?? null);
const earliestBackfill = computed(() =>
  lastCalendarDate.value
    ? formatUtc(new Date(parseUtc(lastCalendarDate.value).getTime() - MAX_BACKFILL_DAYS * MS_PER_DAY))
    : null,
);

function isClickable(cell: Cell): boolean {
  return (
    !props.disabled &&
    cell.status === 'missed' &&
    cell.date !== null &&
    earliestBackfill.value !== null &&
    cell.date >= earliestBackfill.value
  );
}

function cellState(cell: Cell): HeatState {
  if (cell.status === 'done') return 'done';
  if (cell.status === 'missed') return isClickable(cell) ? 'repairable' : 'missed';
  // not_scheduled (or unknown): today reads as pending only when it's actually a due day.
  if (cell.isToday && props.todayDue) return 'today_pending';
  return 'not_scheduled';
}

const STATE_LABEL: Record<HeatState, string> = {
  done: 'done',
  missed: 'missed',
  not_scheduled: 'not scheduled',
  repairable: 'missed — click to mark done',
  backfilled: 'backfilled',
  threshold: 'done — streak milestone',
  today_pending: 'today, pending',
};
function cellTitle(cell: Cell): string {
  if (!cell.date) return '';
  const [, m, d] = cell.date.split('-');
  return `${d}.${m} — ${STATE_LABEL[cellState(cell)]}`;
}
function cellAria(cell: Cell): string {
  return cell.date ? `${cell.date}: ${STATE_LABEL[cellState(cell)]}` : '';
}
function onCellClick(cell: Cell): void {
  if (isClickable(cell) && cell.date) emit('backfill', cell.date);
}

// Repairable days, newest first — the touch path (the grid cells are pointer targets).
const repairable = computed(() =>
  props.calendar
    .filter((d) => isClickable({ date: d.date, status: d.status, isToday: false }))
    .map((d) => d.date)
    .reverse(),
);
function shortDate(ds: string): string {
  const [, m, d] = ds.split('-').map(Number);
  return `${d} ${MONTHS[(m! - 1)]}`;
}

// Scroll the grid to the right (today) on mount — mobile shows the most recent weeks first.
const scrollEl = ref<HTMLElement | null>(null);
onMounted(() => {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollLeft = scrollEl.value.scrollWidth;
  });
});
</script>

<template>
  <div v-if="weeks.length" class="flex flex-col gap-3">
    <div ref="scrollEl" class="overflow-x-auto">
      <div class="inline-flex flex-col gap-[3px]">
        <!-- Month labels -->
        <div class="flex gap-[3px] font-dl-mono text-[9px] leading-none text-dl-ink-muted">
          <div class="w-3 shrink-0" />
          <div v-for="(week, wi) in weeks" :key="wi" class="shrink-0 whitespace-nowrap" :style="{ width: `${CELL}px` }">{{ week.monthLabel }}</div>
        </div>
        <!-- Day-label column + week columns -->
        <div class="flex gap-[3px]">
          <div class="flex w-3 shrink-0 flex-col gap-[3px] font-dl-mono text-[9px] leading-none text-dl-ink-muted">
            <div v-for="(label, ri) in DAY_LABELS" :key="ri" class="flex items-center" :style="{ height: `${CELL}px` }">{{ label }}</div>
          </div>
          <div v-for="(week, wi) in weeks" :key="wi" class="flex flex-col gap-[3px]">
            <template v-for="(cell, ri) in week.cells" :key="ri">
              <span v-if="!cell.date" class="inline-block shrink-0" :style="{ width: `${CELL}px`, height: `${CELL}px` }" />
              <button
                v-else-if="cellState(cell) === 'repairable'"
                type="button"
                class="dl-focus-outset rounded-[2px] border-0 bg-transparent p-0 hover:brightness-95"
                :class="cell.date === pendingDate ? 'animate-pulse' : 'cursor-pointer'"
                :title="cellTitle(cell)"
                :aria-label="cellAria(cell)"
                :disabled="disabled"
                @click="onCellClick(cell)"
              >
                <HeatCell state="repairable" :size="CELL" />
              </button>
              <span v-else :title="cellTitle(cell)" :aria-label="cellAria(cell)">
                <HeatCell :state="cellState(cell)" :size="CELL" />
              </span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend — the same forms, at rest. -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-dl-mono text-dl-label text-dl-ink-muted">
      <span class="flex items-center gap-1.5"><HeatCell state="done" :size="12" />Done</span>
      <span class="flex items-center gap-1.5"><HeatCell state="missed" :size="12" />Missed</span>
      <span class="flex items-center gap-1.5"><HeatCell state="not_scheduled" :size="12" />Not scheduled</span>
      <span class="flex items-center gap-1.5"><HeatCell state="repairable" :size="12" />Repairable</span>
      <span class="flex items-center gap-1.5"><HeatCell state="backfilled" :size="12" />Backfilled</span>
      <span class="flex items-center gap-1.5"><HeatCell state="threshold" :size="12" />Threshold</span>
    </div>

    <!-- Touch repair path: the grid cells are 16px pointer targets, so on small screens the
         repairable days are also offered as full-width rows. -->
    <div v-if="repairable.length" class="flex flex-col gap-1 md:hidden">
      <div
        v-for="date in repairable"
        :key="date"
        class="flex h-[60px] items-center justify-between border border-dl-hairline bg-dl-surface px-3"
      >
        <span class="flex items-center gap-2 text-dl-body text-dl-ink">
          <HeatCell state="repairable" :size="16" />
          {{ shortDate(date) }}
        </span>
        <button
          type="button"
          class="dl-focus-inset min-h-dl-touch cursor-pointer bg-dl-violet px-4 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white disabled:opacity-50"
          :class="date === pendingDate ? 'animate-pulse' : ''"
          :disabled="disabled"
          @click="emit('backfill', date)"
        >
          Mark done
        </button>
      </div>
    </div>
  </div>
</template>
