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
    errorMsg.value = 'Could not create ritual. Check the fields and try again.';
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
      res.status === 409 ? 'This ritual can no longer be edited.' : 'Could not save changes.';
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
  <form
    class="flex flex-col gap-[0.7rem] rounded-none border border-line bg-[rgba(14,9,30,0.6)] p-4"
    @submit.prevent="onSubmit"
  >
    <p class="m-0 text-[0.7rem] tracking-[0.3em] text-accent">
      {{ mode === 'edit' ? '[ EDIT RITUAL ]' : '[ NEW RITUAL ]' }}
    </p>

    <input
      v-model="title"
      type="text"
      placeholder="Title"
      required
      maxlength="255"
      class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] font-[inherit] text-ink-soft outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
    />
    <textarea
      v-model="description"
      placeholder="Description (optional)"
      rows="2"
      class="resize-y rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] font-[inherit] text-ink-soft outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
    />

    <div class="flex gap-[0.7rem]">
      <label class="flex flex-1 flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
        Rank — always +{{ RECURRING_XP }} XP
        <select
          v-model="difficulty"
          class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] font-[inherit] text-ink-soft outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
        >
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label class="flex flex-1 flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
        Repeats
        <select
          v-model="recurrenceType"
          class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] font-[inherit] text-ink-soft outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
        >
          <option value="daily">Every day</option>
          <option value="every_x_days">Every N days</option>
          <option value="weekdays">On weekdays</option>
        </select>
      </label>
    </div>

    <label
      v-if="recurrenceType === 'every_x_days'"
      class="flex flex-1 flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted"
    >
      Every N days
      <input
        v-model.number="everyXDays"
        type="number"
        min="1"
        class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] font-[inherit] text-ink-soft outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
      />
    </label>

    <div
      v-else-if="recurrenceType === 'weekdays'"
      class="flex flex-wrap gap-x-[0.9rem] gap-y-[0.5rem] text-[0.78rem] text-ink-muted"
    >
      <label
        v-for="(day, i) in WEEKDAYS"
        :key="day"
        class="flex cursor-pointer items-center gap-[0.35rem]"
      >
        <input
          v-model="selectedDays[i]"
          type="checkbox"
          class="w-auto cursor-pointer rounded-none border border-line bg-panel p-0 text-[0.9rem] font-[inherit] text-ink-soft outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
        />
        {{ day }}
      </label>
    </div>

    <p v-if="errorMsg" class="m-0 text-[0.78rem] text-danger-bright">{{ errorMsg }}</p>

    <div class="flex gap-[0.6rem]">
      <button
        type="submit"
        :disabled="submitting"
        class="flex-1 cursor-pointer rounded-none border-0 bg-gradient-to-b from-accent-deep to-accent-dark p-[0.6rem] font-semibold text-white shadow-[0_0_14px_rgba(124,92,232,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Issue quest' }}
      </button>
      <button
        v-if="mode === 'edit'"
        type="button"
        :disabled="submitting"
        class="flex-none cursor-pointer rounded-none border border-line bg-transparent p-[0.6rem] font-semibold text-ink shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
