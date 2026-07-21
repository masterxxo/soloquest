<script setup lang="ts">
import { MAX_BACKFILL_DAYS } from '@soloquest/shared';
import type { RecurringCalendarDay } from '~/lib/api-client';

// Completion calendar (GitHub-style heatmap). The backend is the source of truth for each
// day's status (the `calendar` field from /stats) — here we lay days out into weekly
// columns, paint them, and make a due-but-missed day inside the backfill window clickable
// so the player can mark it done after the fact.
const props = defineProps<{
  calendar: RecurringCalendarDay[];
  // Date currently being backfilled (in flight), so its cell can show a pending state.
  pendingDate?: string | null;
  // True while any completion for this ritual is in flight — suppresses new clicks.
  disabled?: boolean;
}>();
const emit = defineEmits<{ backfill: [date: string] }>();

type Status = RecurringCalendarDay['status'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Weekday labels: only selected rows (Mo/We/Fr/Su), the rest are blank.
const DAY_LABELS = ['Mo', '', 'We', '', 'Fr', '', 'Su'];

// The dimmed "not scheduled" cell — a lighter fill + hairline border so the cell stays
// legible even over the animated smoke background (the fill alone blended into the palette).
// Future filler cells (on the right) get the same look.
const NOT_SCHEDULED_CLASS = 'bg-[#2a2352] border border-line-soft';
const STATUS_CLASS: Record<Status, string> = {
  done: 'bg-accent',
  missed: 'bg-danger-bg border border-danger-line',
  not_scheduled: NOT_SCHEDULED_CLASS,
};

// The calendar draws dimmed filler weeks ahead so it doesn't end in emptiness and fills the
// panel width. This is purely frontend cosmetics — the backend returns no future days.
const MIN_FUTURE_WEEKS = 5; // always at least this many weeks past today
const TARGET_WEEKS = 26; // aim for this many columns total (tops up filler for fresh rituals)
const STATUS_LABEL: Record<Status, string> = {
  done: 'Done',
  missed: 'Missed',
  not_scheduled: 'Not scheduled',
};

interface Cell {
  date: string | null; // null → empty padding cell (before the window start), transparent
  status: Status | null;
  isToday: boolean;
  future: boolean; // a day past today → dimmed filler, no status
}
interface Week {
  cells: Cell[]; // length 7, index 0 = Monday
  monthLabel: string | null; // month label above the column (shown when the month changes)
}

/** Parses 'YYYY-MM-DD' into a Date at UTC midnight — consistent with the backend's dates. */
function parseUtc(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  // value is always a 'YYYY-MM-DD' string from the backend, so all parts are present.
  return new Date(Date.UTC(y!, m! - 1, d!));
}
/** Formats a Date back to 'YYYY-MM-DD' using its UTC components. */
function formatUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
/** Monday of the week containing `date` (0=Mon … 6=Sun). */
function mondayOf(date: Date): Date {
  const dow = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - dow * MS_PER_DAY);
}

const weeks = computed<Week[]>(() => {
  const cal = props.calendar;
  if (!cal.length) return [];

  const statusByDate = new Map<string, Status>(cal.map((d) => [d.date, d.status]));
  const first = parseUtc(cal[0]!.date);
  const todayStr = cal[cal.length - 1]!.date; // last element = today (no future days)
  const todayTime = parseUtc(todayStr).getTime();
  const gridStart = mondayOf(first).getTime(); // align the start to a Monday
  // Column count through the week containing "today", and how many we render in total (with filler).
  const weeksThroughToday =
    Math.round((mondayOf(parseUtc(todayStr)).getTime() - gridStart) / (7 * MS_PER_DAY)) + 1;
  const totalWeeks = Math.max(TARGET_WEEKS, weeksThroughToday + MIN_FUTURE_WEEKS);

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
      if (time < first.getTime()) {
        // Days before the window (at the start of the first week) → empty, transparent.
        cells.push({ date: null, status: null, isToday: false, future: false });
      } else if (time <= todayTime) {
        // A real day — its status comes from the backend.
        cells.push({
          date: ds,
          status: statusByDate.get(ds) ?? null,
          isToday: ds === todayStr,
          future: false,
        });
      } else {
        // A future day → dimmed filler ("not scheduled" look, no status).
        cells.push({ date: ds, status: null, isToday: false, future: true });
      }
      cursor += MS_PER_DAY;
    }
    // Month label shown when the column's Monday falls in a different month than the previous one.
    const month = mondayDate!.getUTCMonth();
    result.push({ cells, monthLabel: month !== prevMonth ? MONTHS[month]! : null });
    prevMonth = month;
  }
  return result;
});

function cellClass(cell: Cell): string {
  if (!cell.date) return 'bg-transparent'; // padding before the window
  if (cell.future) return NOT_SCHEDULED_CLASS; // future filler — no "today" ring
  const base = cell.status ? STATUS_CLASS[cell.status] : NOT_SCHEDULED_CLASS;
  const parts = [cell.isToday ? `${base} ring-1 ring-accent-soft` : base];
  if (cell.date === props.pendingDate) parts.push('animate-pulse ring-1 ring-accent-soft');
  else if (isClickable(cell)) parts.push('cursor-pointer hover:brightness-150 hover:ring-1 hover:ring-accent-soft');
  return parts.join(' ');
}
function cellTitle(cell: Cell): string {
  if (!cell.date) return '';
  const [, m, d] = cell.date.split('-');
  // Future (filler) days have no status — show just the date, without a misleading label.
  if (cell.future || !cell.status) return `${d}.${m}`;
  const base = `${d}.${m} — ${STATUS_LABEL[cell.status]}`;
  return isClickable(cell) ? `${base} · Click to mark as done` : base;
}

// Oldest day still inside the backfill window: today − MAX_BACKFILL_DAYS. Today is the
// calendar's last cell (the backend never returns future days). A missed day is clickable
// when it is on/after that bound — mirrors the server's isWithinBackfillWindow exactly.
const lastCalendarDate = computed(() => props.calendar.at(-1)?.date ?? null);
const earliestBackfill = computed(() =>
  lastCalendarDate.value
    ? formatUtc(new Date(parseUtc(lastCalendarDate.value).getTime() - MAX_BACKFILL_DAYS * MS_PER_DAY))
    : null,
);

// Only a *missed* day (a closed, required, uncompleted day — never today, done, future or
// not-scheduled) can be backfilled, and only within the window.
function isClickable(cell: Cell): boolean {
  return (
    !props.disabled &&
    cell.status === 'missed' &&
    cell.date !== null &&
    earliestBackfill.value !== null &&
    cell.date >= earliestBackfill.value
  );
}
function cellAriaLabel(cell: Cell): string {
  if (!cell.date) return '';
  if (cell.future || !cell.status) return cell.date;
  const state = isClickable(cell) ? 'missed, mark as done' : STATUS_LABEL[cell.status].toLowerCase();
  return `${cell.date}: ${state}`;
}
function onCellClick(cell: Cell): void {
  if (isClickable(cell) && cell.date) emit('backfill', cell.date);
}
</script>

<template>
  <div v-if="weeks.length" class="overflow-x-auto">
    <div class="inline-flex flex-col gap-[5px]">
      <!-- Month labels above the columns (the left spacer aligns them with the day labels). -->
      <div class="flex gap-[3px] text-[9px] leading-none text-ink-muted">
        <div class="w-6 shrink-0" />
        <div v-for="(week, wi) in weeks" :key="wi" class="w-3 shrink-0 whitespace-nowrap">
          {{ week.monthLabel }}
        </div>
      </div>

      <!-- Body: the day-label column + the week columns. -->
      <div class="flex gap-[3px]">
        <div class="flex w-6 shrink-0 flex-col gap-[3px] text-[9px] leading-none text-ink-muted">
          <div v-for="(label, ri) in DAY_LABELS" :key="ri" class="flex h-3 items-center">
            {{ label }}
          </div>
        </div>

        <div v-for="(week, wi) in weeks" :key="wi" class="flex flex-col gap-[3px]">
          <template v-for="(cell, ri) in week.cells" :key="ri">
            <!-- A due-but-missed day inside the backfill window: a real button so it's
                 reachable by keyboard and announced with its date + state. -->
            <button
              v-if="isClickable(cell)"
              type="button"
              class="h-3 w-3 rounded-[2px] border-0 p-0"
              :class="cellClass(cell)"
              :title="cellTitle(cell)"
              :aria-label="cellAriaLabel(cell)"
              :disabled="disabled"
              @click="onCellClick(cell)"
            />
            <!-- Every other day: display only. -->
            <div
              v-else
              class="h-3 w-3 rounded-[2px]"
              :class="cellClass(cell)"
              :title="cellTitle(cell)"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Legend. -->
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-ink-muted">
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-[2px] bg-accent" />Done
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-[2px] border border-danger-line bg-danger-bg" />Missed
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-[2px]" :class="NOT_SCHEDULED_CLASS" />Not scheduled
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-[2px] ring-1 ring-accent-soft" :class="NOT_SCHEDULED_CLASS" />Today
      </span>
    </div>
  </div>
</template>
