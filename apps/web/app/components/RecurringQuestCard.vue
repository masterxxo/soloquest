<script setup lang="ts">
import {
  client,
  type RecurringQuest,
  type RecurringQuestWithStreak,
  type RecurringCompleteResult,
  type Achievement,
} from '~/lib/api-client';
import { RANK_COLORS } from '~/composables/useQuestActions';

const props = defineProps<{ quest: RecurringQuestWithStreak }>();
const emit = defineEmits<{
  completed: [result: RecurringCompleteResult];
  deleted: [id: string];
  updated: [quest: RecurringQuest];
  achievementsEarned: [achievements: Achievement[]];
}>();

// Weekday labels in bitmask order: bit 0 = Mon … bit 6 = Sun (matches the DB/recurrence doc).
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Flat reward — recurring quests always grant +10 XP regardless of (cosmetic) rank.
const RECURRING_XP = 10;

const editing = ref(false);
const completing = ref(false);
const deleting = ref(false);
const errorMsg = ref<string | null>(null);

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

// Today's date in the CLIENT's local timezone as YYYY-MM-DD — never UTC, so the
// completion lands on the user's own calendar day (matches the backend's timezone logic).
function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function onComplete() {
  completing.value = true;
  errorMsg.value = null;
  try {
    const res = await client.api['recurring-quests'][':id'].complete.$post({
      param: { id: props.quest.id },
      json: { completedDate: localDateString() },
    });
    if (!res.ok) {
      errorMsg.value =
        res.status === 409 ? 'Already completed today.' : 'Could not complete quest.';
      return;
    }
    const result = await res.json();
    emit('completed', result);
    // Surface any freshly-crossed achievements so the page can toast them.
    if (result.newAchievements.length > 0) emit('achievementsEarned', result.newAchievements);
  } finally {
    completing.value = false;
  }
}

async function onDelete() {
  if (!confirm(`Delete ritual "${props.quest.title}"?`)) return;
  deleting.value = true;
  errorMsg.value = null;
  try {
    const res = await client.api['recurring-quests'][':id'].$delete({
      param: { id: props.quest.id },
    });
    if (!res.ok) {
      errorMsg.value = 'Could not delete quest.';
      return;
    }
    emit('deleted', props.quest.id);
  } finally {
    deleting.value = false;
  }
}

function onUpdated(quest: RecurringQuest) {
  editing.value = false;
  emit('updated', quest);
}
</script>

<template>
  <div class="quest-wrap">
    <RecurringQuestForm
      v-if="editing"
      mode="edit"
      :initial="quest"
      @updated="onUpdated"
      @cancel="editing = false"
    />

    <article v-else class="quest">
      <span class="rank" :style="{ color: rankColor, borderColor: rankColor }">
        {{ quest.difficulty }}
      </span>

      <div class="body">
        <h3>{{ quest.title }}</h3>
        <p class="recurrence">🔁 {{ recurrenceLabel }}</p>
        <p v-if="quest.description" class="desc">{{ quest.description }}</p>
        <div class="meta">
          <span class="xp">+{{ RECURRING_XP }} XP</span>
          <span class="streak">
            🔥 {{ quest.streak?.currentStreak ?? 0 }} streak ·
            {{ quest.streak?.totalCompletions ?? 0 }} total
          </span>
        </div>
        <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
      </div>

      <div class="actions">
        <button class="edit" :disabled="completing || deleting" @click="editing = true">
          Edit
        </button>

        <!-- Already done today → static badge instead of a button. -->
        <span v-if="quest.isCompletedToday" class="done-badge">✓ Done today</span>
        <!-- Due and not yet done → live Complete button. -->
        <button
          v-else-if="quest.isDueToday"
          class="complete"
          :disabled="completing || deleting"
          @click="onComplete"
        >
          {{ completing ? '…' : 'Complete' }}
        </button>
        <!-- Not scheduled for today → disabled, with an explanatory tooltip. -->
        <button v-else class="complete" disabled title="Not due today">Complete</button>

        <button
          class="delete"
          :disabled="completing || deleting"
          @click="onDelete"
          aria-label="Delete ritual"
        >
          {{ deleting ? '…' : '✕' }}
        </button>
      </div>
    </article>
  </div>
</template>

<style scoped>
.quest-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
.quest {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.6rem 0.8rem;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
  border-radius: 0;
}
.rank {
  flex: 0 0 auto;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.9rem;
  border: 1px solid;
  border-radius: 0;
  background: #0a0618;
  text-shadow: 0 0 8px currentColor;
}
.body { flex: 1 1 auto; min-width: 0; }
h3 { margin: 0; font-size: 0.95rem; color: #ece8fb; }
.recurrence { margin: 0.15rem 0 0; font-size: 0.7rem; color: #6a5da0; }
.desc {
  margin: 0.2rem 0 0.3rem;
  font-size: 0.85rem;
  color: #8174b8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #8174b8; flex-wrap: wrap; }
.xp { color: #9c7cff; font-weight: 600; }
.streak { color: #f0903c; }
.err { margin: 0.4rem 0 0; font-size: 0.75rem; color: #ff8080; }
.actions { display: flex; gap: 0.4rem; flex: 0 0 auto; align-items: center; }
button {
  padding: 0.35rem 0.65rem;
  border-radius: 0;
  font-weight: 600;
  font-size: 0.78rem;
  cursor: pointer;
  border: 1px solid #2a2050;
}
.edit { background: transparent; color: #d0c8f8; border-color: #2a2050; }
.complete { background: linear-gradient(180deg, #6a4fd8, #4a35a8); color: #fff; border: none; }
.delete { background: transparent; color: #ff8080; border-color: #5a2740; }
.done-badge {
  padding: 0.35rem 0.65rem;
  font-weight: 600;
  font-size: 0.78rem;
  color: #3fbf6f;
  border: 1px solid #1f5a3a;
  background: rgba(63, 191, 111, 0.08);
}
button:hover:not(:disabled) { filter: brightness(1.1); }
button:disabled { opacity: 0.55; cursor: not-allowed; }
</style>
