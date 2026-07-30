<script setup lang="ts">
import type {
  RecurringQuestWithStreak,
  RecurringCompleteResult,
  Achievement,
} from '~/lib/api-client';
import type { HeatState } from '~/components/HeatCell.vue';
import { recurrenceLabel } from '~/lib/recurrence';
import { useRecurringQuestActions } from '~/composables/useRecurringQuestActions';
import { useReducedMotion } from '~/composables/useReducedMotion';
import { RECURRING_XP_REWARD } from '@soloquest/shared';

const props = defineProps<{ quest: RecurringQuestWithStreak }>();
const emit = defineEmits<{
  completed: [result: RecurringCompleteResult];
  deleted: [id: string];
  achievementsEarned: [achievements: Achievement[]];
  open: [quest: RecurringQuestWithStreak, event: MouseEvent];
}>();

const recurrence = computed(() => recurrenceLabel(props.quest));

const { reduced } = useReducedMotion();

// Store-authoritative "done today" — the resting truth (on load, and once a request settles).
// Rituals are never "overdue"; the three card states are done-today / due-and-pending / not-due.
const done = computed(() => props.quest.isCompletedToday);
const due = computed(() => props.quest.isDueToday && !done.value);

// Optimistic completion state — the checkbox gesture, the today-pip fill and the streak bump all
// fire the instant the box is pressed, decoupled from the network round-trip; only a FAILED
// request rolls them back. Unlike a quest (which slides out of its list), a ritual is repeatable
// and STAYS on its card once done — the streak reacts instead of the row leaving.
const playing = ref(false); // checkbox flash→settle→draw is running (0ms → ~440ms)
const pipFilled = ref(false); // today's pip has flipped pending → done (~200ms)
const bumping = ref(false); // streak numeral is mid-bump (~420ms, ~200ms long)
const optimisticStreak = ref<number | null>(null); // freeze at base, then base+1 at the bump

// Visual "is completed": the optimistic play OR the settled store flag. The two hand off cleanly —
// on success the store also reads done, so clearing the overrides is a no-op frame.
const showCompleted = computed(() => playing.value || done.value);
const pipDone = computed(() => pipFilled.value || done.value);

const stripeClass = computed(() =>
  showCompleted.value ? 'bg-dl-lime' : due.value ? 'bg-dl-violet' : 'bg-dl-grid-line',
);

// The 7-day strip is a preview of the rolling window, never the source (the streak numeral is
// the truth). It renders the list payload's real per-day history (`last7`, oldest → today in
// the user's tz): each backend status maps 1:1 onto the shared HeatCell form vocabulary, the
// same forms the heatmap uses. The final cell is TODAY — the backend can't encode "due but not
// yet done" as a status (an in-progress today comes back not_scheduled), so we resolve its
// pending look here from isDueToday. That pending pip is the one the complete animation fills.
const todayState = computed<HeatState>(() =>
  pipDone.value ? 'done' : due.value ? 'today_pending' : 'not_scheduled',
);
const strip = computed<HeatState[]>(() =>
  props.quest.last7.map((day, i, days) => (i === days.length - 1 ? todayState.value : day.status)),
);
const stripSummary = computed(() =>
  showCompleted.value ? 'Done today' : due.value ? 'Today pending' : 'Not due today',
);

// The streak numeral: the store value at rest; during a completion it FREEZES at the pre-click
// value, then increments by one exactly at the bump beat — so the number never runs ahead of (or
// lags) the visible bump, regardless of how fast the request resolves.
const displayStreak = computed(
  () => optimisticStreak.value ?? props.quest.streak?.currentStreak ?? 0,
);

const { completing, errorMsg, onComplete } = useRecurringQuestActions(() => props.quest, {
  completed: (r) => emit('completed', r),
  deleted: (id) => emit('deleted', id),
  achievementsEarned: (a) => emit('achievementsEarned', a),
});

// Ritual complete beats, from the click (runtime-verified against QuestRow's quest-complete
// gesture, whose checkbox choreography this reuses via the shared `.dl-check-*` motion tokens):
//   0ms      checkbox flash lime → settle violet + checkmark draws (`.dl-check-on`, ~440ms)
//   ~200ms   today's pip fills pending → done (HeatCell colour transition, ~280ms)
//   ~420ms   current-streak numeral ticks up by one with a short violet bump (~200ms)
//   ~700ms   the gesture is done — hand the resting look back to the store
const PIP_AT_MS = 200;
const BUMP_AT_MS = 420;
const BUMP_MS = 200;
const SETTLE_MS = 700;

let timers: ReturnType<typeof setTimeout>[] = [];
function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}
// Drop every optimistic override — the card falls back to the store-authoritative state (a clean
// revert on failure, a seamless handoff on success since the store shows the identical settled look).
function resetPlay() {
  clearTimers();
  playing.value = false;
  pipFilled.value = false;
  bumping.value = false;
  optimisticStreak.value = null;
}

async function handleComplete() {
  if (playing.value) return; // a completion is already animating on this card
  const base = props.quest.streak?.currentStreak ?? 0;
  playing.value = true;

  if (reduced.value) {
    // No motion: settle to the final look at once (the CSS guard zeroes the tweens anyway).
    pipFilled.value = true;
    optimisticStreak.value = base + 1;
  } else {
    optimisticStreak.value = base; // freeze the numeral until the bump beat
    timers.push(setTimeout(() => { pipFilled.value = true; }, PIP_AT_MS));
    timers.push(
      setTimeout(() => {
        optimisticStreak.value = base + 1;
        bumping.value = true;
      }, BUMP_AT_MS),
    );
    timers.push(setTimeout(() => { bumping.value = false; }, BUMP_AT_MS + BUMP_MS));
  }

  try {
    await onComplete();
  } catch {
    resetPlay(); // network error — revert checkbox, pip and streak
    return;
  }
  // A handled failure set errorMsg (server changed nothing) — roll the optimism back.
  if (errorMsg.value !== null) {
    resetPlay();
    return;
  }

  // Success (or a 409 the composable already reconciled to "done today"): let the animation finish,
  // then hand the resting visual to the store. Clearing the overrides is a no-op frame — the store
  // now shows the same settled check, filled pip and base+1 streak.
  if (reduced.value) resetPlay();
  else timers.push(setTimeout(resetPlay, SETTLE_MS));
}

onUnmounted(clearTimers);
</script>

<template>
  <div class="flex flex-col">
    <article class="relative flex min-h-[64px] items-center gap-3 border border-dl-hairline bg-dl-surface py-2 pl-3 pr-4">
      <span class="absolute inset-y-0 left-0 w-[3px]" :class="stripeClass" aria-hidden="true" />

      <!-- Checkbox — reuses the quest-row gesture (flash lime → settle violet → draw the checkmark)
           via the shared `.dl-check-*` motion tokens. Three presentations: interactive+animating
           (due, and while the completion animates), a static settled check (resting done — a ritual
           STAYS done on its card, so `.dl-check-settled` shows the drawn mark WITHOUT replaying the
           lime flash on reload), and a neutral dashed box (not due). -->
      <button
        v-if="due || playing"
        type="button"
        role="checkbox"
        :aria-checked="showCompleted"
        :aria-label="`Complete ${quest.title}`"
        :disabled="completing || !due"
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center disabled:cursor-not-allowed md:min-h-0 md:min-w-0"
        :class="completing ? 'cursor-progress' : due ? 'cursor-pointer' : 'cursor-default'"
        @click="handleComplete"
      >
        <span
          class="dl-check corner-cut-sm grid h-5 w-5 place-items-center border bg-dl-surface transition-colors duration-dl-standard ease-dl"
          :class="showCompleted ? 'dl-check-on border-dl-violet' : 'border-dl-band-line hover:border-dl-violet'"
        >
          <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
            <path class="dl-check-mark" d="M4 8.5 L7 11.5 L12.5 5" stroke="#fff" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" />
          </svg>
        </span>
      </button>
      <span
        v-else-if="done"
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center md:min-h-0 md:min-w-0"
        aria-hidden="true"
      >
        <span class="dl-check dl-check-settled corner-cut-sm grid h-5 w-5 place-items-center border border-dl-violet bg-dl-violet">
          <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
            <path class="dl-check-mark" d="M4 8.5 L7 11.5 L12.5 5" stroke="#fff" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" />
          </svg>
        </span>
      </span>
      <span v-else class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center md:min-h-0 md:min-w-0" aria-hidden="true">
        <span class="corner-cut-sm grid h-5 w-5 place-items-center border border-dashed border-dl-band-line" />
      </span>

      <!-- Name + recurrence + preview strip -->
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          class="dl-focus-inset min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-dl-body text-dl-ink [font:inherit] hover:text-dl-violet"
          @click="emit('open', quest, $event)"
        >{{ quest.title }}</button>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">
          <span>{{ recurrence }} · {{ RECURRING_XP_REWARD }} XP</span>
          <span class="flex items-center gap-1.5">
            <span class="flex gap-[2px]">
              <HeatCell v-for="(s, i) in strip" :key="i" :state="s" :size="10" />
            </span>
            <span class="normal-case">{{ stripSummary }}</span>
          </span>
        </div>
        <p v-if="errorMsg" class="m-0 text-dl-meta text-dl-magenta">{{ errorMsg }}</p>
      </div>

      <!-- Streak numeral — the truth, set like the level in the telemetry bar. On completion it
           ticks up by one with a short violet bump (the ritual's one numeric reward). -->
      <div class="flex shrink-0 flex-col items-end leading-none">
        <span
          class="inline-block font-dl-mono text-dl-numeral font-semibold text-dl-ink"
          :class="{ 'dl-streak-bump': bumping }"
        >{{ displayStreak }}</span>
        <span class="mt-0.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Day streak</span>
        <span class="mt-1 font-dl-mono text-dl-label text-dl-ink-faint">longest {{ quest.streak?.longestStreak ?? 0 }} · total {{ quest.streak?.totalCompletions ?? 0 }}</span>
      </div>
    </article>
  </div>
</template>
