<script setup lang="ts">
import type {
  RecurringQuestWithStreak,
  RecurringCompleteResult,
  Achievement,
} from '~/lib/api-client';
import type { HeatState } from '~/components/HeatCell.vue';
import { recurrenceLabel } from '~/lib/recurrence';
import { useRecurringQuestActions } from '~/composables/useRecurringQuestActions';
import { RECURRING_XP_REWARD } from '@soloquest/shared';

const props = defineProps<{ quest: RecurringQuestWithStreak }>();
const emit = defineEmits<{
  completed: [result: RecurringCompleteResult];
  deleted: [id: string];
  achievementsEarned: [achievements: Achievement[]];
  open: [quest: RecurringQuestWithStreak, event: MouseEvent];
}>();

const recurrence = computed(() => recurrenceLabel(props.quest));

// Card state → the checkbox and the leading stripe. Rituals are never "overdue"; the three
// states are done-today / due-and-pending / not-due.
const done = computed(() => props.quest.isCompletedToday);
const due = computed(() => props.quest.isDueToday && !done.value);
const stripeClass = computed(() =>
  done.value ? 'bg-dl-lime' : due.value ? 'bg-dl-violet' : 'bg-dl-grid-line',
);

// The 7-day strip is a preview of the rolling window, never the source (the streak numeral is
// the truth). The list payload doesn't carry per-day history, so only today's cell is live;
// the earlier six render in their NOT SCHEDULED form as a preview.
const todayState = computed<HeatState>(() =>
  done.value ? 'done' : due.value ? 'today_pending' : 'not_scheduled',
);
const strip = computed<HeatState[]>(() => [
  ...Array<HeatState>(6).fill('not_scheduled'),
  todayState.value,
]);
const stripSummary = computed(() =>
  done.value ? 'Done today' : due.value ? 'Today pending' : 'Not due today',
);

const { completing, errorMsg, onComplete } = useRecurringQuestActions(() => props.quest, {
  completed: (r) => emit('completed', r),
  deleted: (id) => emit('deleted', id),
  achievementsEarned: (a) => emit('achievementsEarned', a),
});
</script>

<template>
  <div class="flex flex-col">
    <article class="relative flex min-h-[64px] items-center gap-3 border border-dl-hairline bg-dl-surface py-2 pl-3 pr-4">
      <span class="absolute inset-y-0 left-0 w-[3px]" :class="stripeClass" aria-hidden="true" />

      <!-- Checkbox — completes when due; static done/neutral otherwise. -->
      <button
        v-if="due"
        type="button"
        role="checkbox"
        :aria-checked="false"
        :aria-label="`Complete ${quest.title}`"
        :disabled="completing"
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center md:min-h-0 md:min-w-0"
        :class="completing ? 'animate-pulse' : 'cursor-pointer'"
        @click="onComplete"
      >
        <span class="corner-cut-sm grid h-5 w-5 place-items-center border border-dl-band-line bg-dl-surface hover:border-dl-violet" />
      </button>
      <span v-else class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center md:min-h-0 md:min-w-0" aria-hidden="true">
        <span
          v-if="done"
          class="corner-cut-sm grid h-5 w-5 place-items-center border border-dl-lime bg-dl-lime/20 text-[0.7rem] leading-none text-dl-ink"
        >✓</span>
        <span v-else class="corner-cut-sm grid h-5 w-5 place-items-center border border-dashed border-dl-band-line" />
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

      <!-- Streak numeral — the truth, set like the level in the telemetry bar. -->
      <div class="flex shrink-0 flex-col items-end leading-none">
        <span class="font-dl-mono text-dl-numeral font-semibold text-dl-ink">{{ quest.streak?.currentStreak ?? 0 }}</span>
        <span class="mt-0.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Day streak</span>
        <span class="mt-1 font-dl-mono text-dl-label text-dl-ink-faint">longest {{ quest.streak?.longestStreak ?? 0 }} · total {{ quest.streak?.totalCompletions ?? 0 }}</span>
      </div>
    </article>
  </div>
</template>
