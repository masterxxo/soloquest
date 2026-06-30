<script setup lang="ts">
import { client, type RecurringQuest } from '~/lib/api-client';
import { RECURRENCE_TYPES, type RecurrenceType } from '@soloquest/shared';

const props = withDefaults(
  defineProps<{ mode?: 'create' | 'edit'; initial?: RecurringQuest | null }>(),
  { mode: 'create', initial: null },
);
const emit = defineEmits<{
  created: [quest: RecurringQuest];
  updated: [quest: RecurringQuest];
  cancel: [];
}>();

const DIFFICULTIES = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

// Completing a recurring quest always grants a flat reward — difficulty is purely
// cosmetic (rank colour on the card). Kept in sync with the backend's RECURRING_XP_REWARD.
const RECURRING_XP = 10;

// Weekday labels in bitmask order: bit 0 = Mon … bit 6 = Sun (matches the DB/recurrence doc).
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const title = ref('');
const description = ref('');
const difficulty = ref<Difficulty>('E');
const recurrenceType = ref<RecurrenceType>('daily');
const everyXDays = ref(2); // only used when recurrenceType === 'every_x_days'
const selectedDays = ref<boolean[]>([false, false, false, false, false, false, false]);
const submitting = ref(false);
const errorMsg = ref<string | null>(null);

// recurrenceValue: bit i set ⇔ WEEKDAYS[i] selected. Positive (≥1) once any day is on.
const weekdayBitmask = computed(() =>
  selectedDays.value.reduce((mask, on, i) => (on ? mask | (1 << i) : mask), 0),
);

// The value the API stores, derived from the chosen recurrence type.
const recurrenceValue = computed<number | null>(() => {
  if (recurrenceType.value === 'every_x_days') return everyXDays.value;
  if (recurrenceType.value === 'weekdays') return weekdayBitmask.value;
  return null; // daily carries no value
});

// Prefill from `initial` (edit mode); decode the stored recurrenceValue back into the
// matching control. Re-syncs if the target quest changes.
watch(
  () => props.initial,
  (q) => {
    title.value = q?.title ?? '';
    description.value = q?.description ?? '';
    difficulty.value = q?.difficulty ?? 'E';
    recurrenceType.value = q?.recurrenceType ?? 'daily';
    everyXDays.value =
      q?.recurrenceType === 'every_x_days' && q.recurrenceValue ? q.recurrenceValue : 2;
    const mask = q?.recurrenceType === 'weekdays' ? q.recurrenceValue ?? 0 : 0;
    selectedDays.value = WEEKDAYS.map((_, i) => ((mask >> i) & 1) === 1);
  },
  { immediate: true },
);

// Reject obviously-invalid recurrence config before hitting the server (mirrors the
// shared zod refinements: every_x_days needs ≥1, weekdays needs ≥1 day picked).
function recurrenceError(): string | null {
  if (recurrenceType.value === 'every_x_days' && everyXDays.value < 1) {
    return 'Interval must be at least 1 day.';
  }
  if (recurrenceType.value === 'weekdays' && weekdayBitmask.value === 0) {
    return 'Pick at least one weekday.';
  }
  return null;
}

async function onCreate() {
  const res = await client.api['recurring-quests'].$post({
    json: {
      title: title.value,
      description: description.value || undefined,
      difficulty: difficulty.value,
      recurrenceType: recurrenceType.value,
      recurrenceValue: recurrenceValue.value,
    },
  });
  if (!res.ok) {
    errorMsg.value = 'Could not create recurring quest. Check the fields and try again.';
    return;
  }
  const { quest } = await res.json();
  emit('created', quest);
  // Reset for the next entry.
  title.value = '';
  description.value = '';
  difficulty.value = 'E';
  recurrenceType.value = 'daily';
  everyXDays.value = 2;
  selectedDays.value = [false, false, false, false, false, false, false];
}

async function onEdit() {
  const initial = props.initial!;
  // Send only changed fields — the server rejects an empty patch.
  const changes: {
    title?: string;
    description?: string;
    difficulty?: Difficulty;
    recurrenceType?: RecurrenceType;
    recurrenceValue?: number | null;
  } = {};
  if (title.value !== initial.title) changes.title = title.value;
  if ((description.value || '') !== (initial.description ?? '')) {
    changes.description = description.value || undefined;
  }
  if (difficulty.value !== initial.difficulty) changes.difficulty = difficulty.value;
  if (recurrenceType.value !== initial.recurrenceType) {
    changes.recurrenceType = recurrenceType.value;
  }
  if (recurrenceValue.value !== (initial.recurrenceValue ?? null)) {
    changes.recurrenceValue = recurrenceValue.value;
  }

  if (Object.keys(changes).length === 0) {
    emit('cancel');
    return;
  }

  const res = await client.api['recurring-quests'][':id'].$patch({
    param: { id: initial.id },
    json: changes,
  });
  if (!res.ok) {
    errorMsg.value =
      res.status === 409 ? 'This recurring quest can no longer be edited.' : 'Could not save changes.';
    return;
  }
  const quest = await res.json();
  emit('updated', quest);
}

async function onSubmit() {
  const recErr = recurrenceError();
  if (recErr) {
    errorMsg.value = recErr;
    return;
  }
  submitting.value = true;
  errorMsg.value = null;
  try {
    if (props.mode === 'edit') await onEdit();
    else await onCreate();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="quest-form" @submit.prevent="onSubmit">
    <p class="tag">{{ mode === 'edit' ? '[ EDIT RECURRING QUEST ]' : '[ NEW RECURRING QUEST ]' }}</p>

    <input v-model="title" type="text" placeholder="Title" required maxlength="255" />
    <textarea v-model="description" placeholder="Description (optional)" rows="2" />

    <div class="row">
      <label>
        Rank — always +{{ RECURRING_XP }} XP
        <select v-model="difficulty">
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label>
        Repeats
        <select v-model="recurrenceType">
          <option value="daily">Every day</option>
          <option value="every_x_days">Every N days</option>
          <option value="weekdays">On weekdays</option>
        </select>
      </label>
    </div>

    <label v-if="recurrenceType === 'every_x_days'" class="single">
      Every N days
      <input v-model.number="everyXDays" type="number" min="1" />
    </label>

    <div v-else-if="recurrenceType === 'weekdays'" class="weekdays">
      <label v-for="(day, i) in WEEKDAYS" :key="day" class="weekday">
        <input v-model="selectedDays[i]" type="checkbox" />
        {{ day }}
      </label>
    </div>

    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

    <div class="form-actions">
      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Issue quest' }}
      </button>
      <button v-if="mode === 'edit'" type="button" class="cancel" :disabled="submitting" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>

<style scoped>
.quest-form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
  border-radius: 0;
}
.tag { margin: 0; letter-spacing: 0.3em; font-size: 0.7rem; color: #7c5ce8; }
input, textarea, select {
  padding: 0.55rem 0.7rem;
  background: #0a0618;
  border: 1px solid #2a2050;
  border-radius: 0;
  color: #ece8fb;
  font: inherit;
  font-size: 0.9rem;
  outline: none;
}
input:focus, textarea:focus, select:focus {
  border-color: #7c5ce8;
  box-shadow: 0 0 0 2px rgba(124, 92, 232, 0.3);
}
textarea { resize: vertical; }
.row { display: flex; gap: 0.7rem; }
.row label, .single {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #8174b8;
}
.weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.9rem;
  font-size: 0.78rem;
  color: #8174b8;
}
.weekday {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}
.weekday input { width: auto; padding: 0; cursor: pointer; }
.err { margin: 0; font-size: 0.78rem; color: #ff8080; }
.form-actions { display: flex; gap: 0.6rem; }
button {
  padding: 0.6rem;
  flex: 1;
  background: linear-gradient(180deg, #6a4fd8, #4a35a8);
  border: none;
  border-radius: 0;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 14px rgba(124, 92, 232, 0.45);
}
button.cancel {
  flex: 0 0 auto;
  background: transparent;
  border: 1px solid #2a2050;
  color: #d0c8f8;
  box-shadow: none;
}
button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
