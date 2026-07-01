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
  edit: [quest: RecurringQuest, event: MouseEvent];
}>();

// Weekday labels in bitmask order: bit 0 = Mon … bit 6 = Sun (matches the DB/recurrence doc).
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Flat reward — recurring quests always grant +10 XP regardless of (cosmetic) rank.
const RECURRING_XP = 10;

const rankColor = computed(() => RANK_COLORS[props.quest.difficulty] ?? '#8a8f98');
const createdLabel = computed(() => new Date(props.quest.createdAt).toLocaleDateString());

// Human-readable recurrence summary.
const recurrenceLabel = computed(() => {
  const q = props.quest;
  if (q.recurrenceType === 'daily') return 'Every day';
  if (q.recurrenceType === 'every_x_days') return `Every ${q.recurrenceValue ?? '?'} days`;
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
  <div class="flex flex-col gap-6">
    <!-- Title row -->
    <header class="flex items-center gap-[0.85rem]">
      <span
        class="grid h-[2.4rem] w-[2.4rem] flex-none place-items-center border bg-panel text-[1.1rem] font-extrabold [text-shadow:0_0_8px_currentColor]"
        :style="{ color: rankColor, borderColor: rankColor }"
      >
        {{ quest.difficulty }}
      </span>
      <div class="min-w-0">
        <h2 class="m-0 text-[1.6rem] leading-[1.2] text-ink-soft">{{ quest.title }}</h2>
        <p class="m-0 mt-[0.15rem] text-[0.8rem] text-[#6a5da0]">🔁 {{ recurrenceLabel }}</p>
      </div>
    </header>

    <!-- Two panes: wide main column + fixed details rail. Stacks on narrow widths. -->
    <div class="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-7 max-[720px]:grid-cols-[1fr]">
      <!-- Main column -->
      <main class="flex min-w-0 flex-col gap-6">
        <section class="flex flex-col gap-[0.6rem]">
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Description</h4>
          <p v-if="quest.description" class="m-0 whitespace-pre-wrap text-[0.95rem] leading-[1.6] text-ink">{{ quest.description }}</p>
          <p v-else class="m-0 text-[0.85rem] text-line-soft">No description.</p>
        </section>

        <section class="flex flex-col gap-[0.6rem]">
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Streak</h4>
          <div class="grid grid-cols-3 gap-3">
            <div class="flex flex-col gap-[0.2rem] border border-line bg-[rgba(14,9,30,0.6)] p-[0.85rem] text-center">
              <span class="text-[1.5rem] font-bold text-[#f0903c]">🔥 {{ quest.streak?.currentStreak ?? 0 }}</span>
              <span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Current</span>
            </div>
            <div class="flex flex-col gap-[0.2rem] border border-line bg-[rgba(14,9,30,0.6)] p-[0.85rem] text-center">
              <span class="text-[1.5rem] font-bold text-ink">{{ quest.streak?.longestStreak ?? 0 }}</span>
              <span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Longest</span>
            </div>
            <div class="flex flex-col gap-[0.2rem] border border-line bg-[rgba(14,9,30,0.6)] p-[0.85rem] text-center">
              <span class="text-[1.5rem] font-bold text-ink">{{ quest.streak?.totalCompletions ?? 0 }}</span>
              <span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Total</span>
            </div>
          </div>
        </section>
      </main>

      <!-- Details sidebar -->
      <aside class="flex flex-col gap-4 border border-line bg-[rgba(14,9,30,0.6)] p-4">
        <div class="flex flex-col gap-2">
          <!-- Already done today → static badge instead of a button. -->
          <span
            v-if="quest.isCompletedToday"
            class="border border-[#1f5a3a] bg-[rgba(63,191,111,0.08)] px-[0.7rem] py-[0.55rem] text-center text-[0.85rem] font-semibold text-[#3fbf6f]"
            >✓ Done today</span
          >
          <!-- Due and not yet done → live Complete button. -->
          <button
            v-else-if="quest.isDueToday"
            class="cursor-pointer border-0 bg-gradient-to-b from-accent-deep to-accent-dark px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-white shadow-[0_0_14px_rgba(124,92,232,0.45)] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
            :disabled="completing || deleting"
            @click="onComplete"
          >
            {{ completing ? '…' : 'Complete' }}
          </button>
          <!-- Not scheduled for today → disabled, with an explanatory tooltip. -->
          <button
            v-else
            class="cursor-not-allowed border-0 bg-gradient-to-b from-accent-deep to-accent-dark px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-white opacity-[.55]"
            disabled
            title="Not due today"
          >
            Complete
          </button>
          <button
            class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-ink enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
            :disabled="completing || deleting"
            @click="emit('edit', quest, $event)"
          >
            Edit
          </button>
          <button
            class="cursor-pointer border border-[#5a2740] bg-transparent px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-danger-bright enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
            :disabled="completing || deleting"
            @click="onDelete"
          >
            {{ deleting ? '…' : 'Delete' }}
          </button>
        </div>
        <p v-if="errorMsg" class="m-0 text-[0.78rem] text-danger-bright">{{ errorMsg }}</p>

        <div>
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Details</h4>
          <dl class="mt-[0.6rem] grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <dt class="text-[0.78rem] text-ink-muted">Rank</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">
              <span
                class="inline-grid h-6 w-6 place-items-center border bg-panel text-[0.8rem] font-extrabold"
                :style="{ color: rankColor, borderColor: rankColor }"
              >
                {{ quest.difficulty }}
              </span>
            </dd>
            <dt class="text-[0.78rem] text-ink-muted">Schedule</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ recurrenceLabel }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">XP reward</dt>
            <dd class="m-0 text-right text-[0.85rem] font-semibold text-accent-light">+{{ RECURRING_XP }} XP</dd>
            <dt class="text-[0.78rem] text-ink-muted">Due today</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ quest.isDueToday ? 'Yes' : 'No' }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">Created</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ createdLabel }}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </div>
</template>
