<script setup lang="ts">
import {
  type RecurringQuest,
  type RecurringQuestWithStreak,
  type RecurringCompleteResult,
  type Achievement,
} from '~/lib/api-client';
import { RANK_COLORS } from '~/composables/useQuestActions';
import { useRecurringQuestActions } from '~/composables/useRecurringQuestActions';

const props = defineProps<{ quest: RecurringQuestWithStreak }>();
const emit = defineEmits<{
  completed: [result: RecurringCompleteResult];
  deleted: [id: string];
  achievementsEarned: [achievements: Achievement[]];
  // Edit / open the detail — both bubble to the page, which owns the modals. `open`
  // carries the full streak object so the detail can render it without a re-fetch.
  edit: [quest: RecurringQuest, event: MouseEvent];
  open: [quest: RecurringQuestWithStreak, event: MouseEvent];
}>();

// Weekday labels in bitmask order: bit 0 = Mon … bit 6 = Sun (matches the DB/recurrence doc).
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Flat reward — recurring quests always grant +10 XP regardless of (cosmetic) rank.
const RECURRING_XP = 10;

const rankColor = computed(() => RANK_COLORS[props.quest.difficulty] ?? '#8a8f98');

// Human-readable recurrence summary shown under the title.
const recurrenceLabel = computed(() => {
  const q = props.quest;
  if (q.recurrenceType === 'daily') return 'Every day';
  if (q.recurrenceType === 'every_x_days') return `Every ${q.recurrenceValue ?? '?'} days`;
  // weekdays → decode the bitmask back into day abbreviations.
  const mask = q.recurrenceValue ?? 0;
  const days = WEEKDAYS.filter((_, i) => ((mask >> i) & 1) === 1);
  return days.length ? days.join(', ') : 'No days set';
});

const { completing, deleting, errorMsg, onComplete, onDelete } = useRecurringQuestActions(
  () => props.quest,
  {
    completed: (r) => emit('completed', r),
    deleted: (id) => emit('deleted', id),
    achievementsEarned: (a) => emit('achievementsEarned', a),
  },
);
</script>

<template>
  <article
    class="flex items-start gap-3 rounded-none border border-line bg-[rgba(14,9,30,0.6)] px-[0.8rem] py-[0.6rem]"
  >
    <span
      class="grid h-7 w-7 flex-none place-items-center rounded-none border bg-panel text-[0.9rem] font-extrabold [text-shadow:0_0_8px_currentColor]"
      :style="{ color: rankColor, borderColor: rankColor }"
    >
      {{ quest.difficulty }}
    </span>

    <div class="min-w-0 flex-auto">
      <h3 class="m-0 text-[0.95rem] text-ink-soft">
        <button
          type="button"
          class="m-0 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit [font:inherit] hover:text-white hover:underline"
          @click="emit('open', quest, $event)"
        >
          {{ quest.title }}
        </button>
      </h3>
      <p class="mt-[0.15rem] text-[0.7rem] text-[#6a5da0]">🔁 {{ recurrenceLabel }}</p>
      <p v-if="quest.description" class="mb-[0.3rem] mt-[0.2rem] line-clamp-2 text-[0.85rem] text-ink-muted">{{ quest.description }}</p>
      <div class="flex flex-wrap gap-3 text-[0.75rem] text-ink-muted">
        <span class="font-semibold text-accent-light">+{{ RECURRING_XP }} XP</span>
        <span class="text-[#f0903c]">
          🔥 {{ quest.streak?.currentStreak ?? 0 }} streak ·
          {{ quest.streak?.totalCompletions ?? 0 }} total
        </span>
      </div>
      <p v-if="errorMsg" class="mt-[0.4rem] text-[0.75rem] text-danger-bright">{{ errorMsg }}</p>
    </div>

    <div class="flex flex-none items-center gap-[0.4rem]">
      <button
        class="cursor-pointer rounded-none border border-line bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
        :disabled="completing || deleting"
        @click="emit('edit', quest, $event)"
      >
        Edit
      </button>

      <!-- Already done today → static badge instead of a button. -->
      <span
        v-if="quest.isCompletedToday"
        class="border border-[#1f5a3a] bg-[rgba(63,191,111,0.08)] px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-[#3fbf6f]"
        >✓ Done today</span
      >
      <!-- Due and not yet done → live Complete button. -->
      <button
        v-else-if="quest.isDueToday"
        class="cursor-pointer rounded-none border-0 bg-gradient-to-b from-accent-deep to-accent-dark px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-white enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
        :disabled="completing || deleting"
        @click="onComplete"
      >
        {{ completing ? '…' : 'Complete' }}
      </button>
      <!-- Not scheduled for today → disabled, with an explanatory tooltip. -->
      <button
        v-else
        class="cursor-pointer rounded-none border-0 bg-gradient-to-b from-accent-deep to-accent-dark px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-white enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
        disabled
        title="Not due today"
      >
        Complete
      </button>

      <button
        class="cursor-pointer rounded-none border border-[#5a2740] bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger-bright enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
        :disabled="completing || deleting"
        @click="onDelete"
        aria-label="Delete ritual"
      >
        {{ deleting ? '…' : '✕' }}
      </button>
    </div>
  </article>
</template>
