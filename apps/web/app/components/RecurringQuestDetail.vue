<script setup lang="ts">
import {
  client,
  type RecurringQuest,
  type RecurringQuestWithStreak,
  type RecurringCompleteResult,
  type Achievement,
} from '~/lib/api-client';
import { recurrenceLabel } from '~/lib/recurrence';
import { formatDate } from '~/lib/date';
import { useRecurringQuestActions } from '~/composables/useRecurringQuestActions';
import { RECURRING_XP_REWARD, MAX_BACKFILL_DAYS } from '@soloquest/shared';

const props = defineProps<{ quest: RecurringQuestWithStreak }>();
const emit = defineEmits<{
  completed: [result: RecurringCompleteResult];
  backfilled: [result: RecurringCompleteResult];
  deleted: [id: string];
  achievementsEarned: [achievements: Achievement[]];
  edit: [quest: RecurringQuest, event: MouseEvent];
}>();

const createdLabel = computed(() => formatDate(props.quest.createdAt));
const recurrence = computed(() => recurrenceLabel(props.quest));

const { completing, deleting, errorMsg, backfillingDate, onComplete, onBackfill, onDelete } =
  useRecurringQuestActions(() => props.quest, {
    completed: (r) => emit('completed', r),
    deleted: (id) => emit('deleted', id),
    achievementsEarned: (a) => emit('achievementsEarned', a),
    backfilled: async (result) => {
      if (result) emit('backfilled', result);
      await refresh();
    },
  });

const { data: stats, error: calendarError, refresh } = useAsyncData(
  `ritual-stats-${props.quest.id}`,
  async () => {
    const res = await client.api['recurring-quests'][':id'].stats.$get({ param: { id: props.quest.id } });
    if (!res.ok) throw new Error('Failed to load ritual stats');
    return res.json();
  },
  { server: false },
);
const calendar = computed(() => stats.value?.calendar ?? []);
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="m-0 font-dl-display text-dl-title font-semibold text-dl-ink">{{ quest.title }}</h2>
        <p class="m-0 mt-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">{{ recurrence }} · since {{ createdLabel }}</p>
      </div>
      <button
        type="button"
        class="dl-focus-inset shrink-0 cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-1.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
        @click="emit('edit', quest, $event)"
      >Edit</button>
    </header>

    <!-- Streak stats -->
    <div class="grid grid-cols-3 gap-3">
      <div class="flex flex-col items-center gap-1 border border-dl-hairline bg-dl-surface py-3">
        <span class="font-dl-mono text-dl-numeral font-semibold text-dl-ink">{{ quest.streak?.currentStreak ?? 0 }}</span>
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Current</span>
      </div>
      <div class="flex flex-col items-center gap-1 border border-dl-hairline bg-dl-surface py-3">
        <span class="font-dl-mono text-dl-numeral font-semibold text-dl-ink">{{ quest.streak?.longestStreak ?? 0 }}</span>
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Longest</span>
      </div>
      <div class="flex flex-col items-center gap-1 border border-dl-hairline bg-dl-surface py-3">
        <span class="font-dl-mono text-dl-numeral font-semibold text-dl-ink">{{ quest.streak?.totalCompletions ?? 0 }}</span>
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Completions</span>
      </div>
    </div>

    <!-- Complete for today (or a static done/not-due state). -->
    <div class="flex flex-col gap-2">
      <span
        v-if="quest.isCompletedToday"
        class="border border-dl-lime bg-dl-lime/15 px-4 py-2.5 text-center font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink"
      >✓ Done today</span>
      <button
        v-else-if="quest.isDueToday"
        type="button"
        class="dl-focus-inset cursor-pointer bg-dl-violet px-4 py-2.5 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
        :class="completing ? 'animate-pulse' : ''"
        :disabled="completing || deleting"
        :aria-busy="completing"
        @click="onComplete"
      >{{ completing ? 'Completing…' : 'Complete today' }}</button>
      <span
        v-else
        class="border border-dashed border-dl-grid-line px-4 py-2.5 text-center font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-faint"
      >Not due today</span>
      <p v-if="errorMsg" class="m-0 text-dl-meta text-dl-magenta">{{ errorMsg }}</p>
    </div>

    <!-- Heatmap -->
    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between border-b border-dl-band-line pb-1">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">History · last {{ MAX_BACKFILL_DAYS }}d repairable</span>
      </div>
      <RecurringQuestHeatmap
        v-if="calendar.length"
        :calendar="calendar"
        :today-due="quest.isDueToday && !quest.isCompletedToday"
        :pending-date="backfillingDate"
        :disabled="completing"
        @backfill="onBackfill"
      />
      <p v-else-if="calendarError" class="m-0 text-dl-meta text-dl-ink-faint">Calendar unavailable.</p>
      <p v-else class="m-0 text-dl-meta text-dl-ink-faint">Loading calendar…</p>
    </section>

    <!-- Details + delete -->
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-dl-band-line pt-4 font-dl-mono text-dl-label">
      <dt class="uppercase tracking-wide text-dl-ink-muted">Schedule</dt>
      <dd class="m-0 text-right text-dl-ink">{{ recurrence }}</dd>
      <dt class="uppercase tracking-wide text-dl-ink-muted">XP reward</dt>
      <dd class="m-0 text-right text-dl-ink">{{ RECURRING_XP_REWARD }} XP</dd>
      <dt class="uppercase tracking-wide text-dl-ink-muted">Created</dt>
      <dd class="m-0 text-right text-dl-ink">{{ createdLabel }}</dd>
    </dl>

    <div class="flex justify-start">
      <button
        type="button"
        class="dl-focus-inset cursor-pointer border border-dl-magenta bg-transparent px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-magenta transition-colors hover:bg-dl-magenta/10 disabled:opacity-60"
        :disabled="completing || deleting"
        @click="onDelete"
      >{{ deleting ? 'Deleting…' : 'Delete ritual' }}</button>
    </div>
  </div>
</template>
