<script setup lang="ts">
import { client, type RecurringQuest } from '~/lib/api-client';
import { WEEKDAYS } from '~/lib/recurrence';
import { RECURRING_XP_REWARD, type Difficulty, type RecurrenceType } from '@soloquest/shared';

const props = withDefaults(
  defineProps<{ mode?: 'create' | 'edit'; initial?: RecurringQuest | null }>(),
  { mode: 'create', initial: null },
);
const emit = defineEmits<{
  created: [quest: RecurringQuest];
  updated: [quest: RecurringQuest];
  cancel: [];
}>();

const title = ref('');
const description = ref('');
// Rituals pay a flat reward, so rank is vestigial and no longer exposed; new rituals default
// to E and edits leave the stored value untouched.
const difficulty = ref<Difficulty>('E');
const recurrenceType = ref<RecurrenceType>('daily');
const everyXDays = ref(2);
const selectedDays = ref<boolean[]>([false, false, false, false, false, false, false]);
const submitting = ref(false);
const errorMsg = ref<string | null>(null);

const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'every_x_days', label: 'Every X days' },
  { value: 'weekdays', label: 'Days of week' },
];

const weekdayBitmask = computed(() =>
  selectedDays.value.reduce((mask, on, i) => (on ? mask | (1 << i) : mask), 0),
);
const recurrenceValue = computed<number | null>(() => {
  if (recurrenceType.value === 'every_x_days') return everyXDays.value;
  if (recurrenceType.value === 'weekdays') return weekdayBitmask.value;
  return null;
});

watch(
  () => props.initial,
  (q) => {
    title.value = q?.title ?? '';
    description.value = q?.description ?? '';
    difficulty.value = q?.difficulty ?? 'E';
    recurrenceType.value = q?.recurrenceType ?? 'daily';
    everyXDays.value = q?.recurrenceType === 'every_x_days' && q.recurrenceValue ? q.recurrenceValue : 2;
    const mask = q?.recurrenceType === 'weekdays' ? q.recurrenceValue ?? 0 : 0;
    selectedDays.value = WEEKDAYS.map((_, i) => ((mask >> i) & 1) === 1);
  },
  { immediate: true },
);

function recurrenceError(): string | null {
  if (recurrenceType.value === 'every_x_days' && everyXDays.value < 1) return 'Interval must be at least 1 day.';
  if (recurrenceType.value === 'weekdays' && weekdayBitmask.value === 0) return 'Pick at least one weekday.';
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
  title.value = '';
  description.value = '';
  recurrenceType.value = 'daily';
  everyXDays.value = 2;
  selectedDays.value = [false, false, false, false, false, false, false];
}

async function onEdit() {
  const initial = props.initial!;
  const changes: {
    title?: string;
    description?: string;
    recurrenceType?: RecurrenceType;
    recurrenceValue?: number | null;
  } = {};
  if (title.value !== initial.title) changes.title = title.value;
  if ((description.value || '') !== (initial.description ?? '')) changes.description = description.value || undefined;
  if (recurrenceType.value !== initial.recurrenceType) changes.recurrenceType = recurrenceType.value;
  if (recurrenceValue.value !== (initial.recurrenceValue ?? null)) changes.recurrenceValue = recurrenceValue.value;

  if (Object.keys(changes).length === 0) {
    emit('cancel');
    return;
  }
  const res = await client.api['recurring-quests'][':id'].$patch({ param: { id: initial.id }, json: changes });
  if (!res.ok) {
    errorMsg.value = res.status === 409 ? 'This ritual can no longer be edited.' : 'Could not save changes.';
    return;
  }
  emit('updated', await res.json());
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
  <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
    <label class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Name</span>
      <input
        v-model="title"
        type="text"
        placeholder="Stretch before bed"
        required
        maxlength="255"
        class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint"
      />
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Description</span>
      <textarea
        v-model="description"
        placeholder="Optional"
        rows="2"
        class="dl-focus-inset resize-y border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint"
      />
    </label>

    <div class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Repeats</span>
      <div class="inline-flex w-full overflow-hidden border border-dl-grid-line" role="group" aria-label="Repeats">
        <button
          v-for="t in RECURRENCE_TYPES"
          :key="t.value"
          type="button"
          :aria-pressed="recurrenceType === t.value"
          class="dl-focus-inset min-h-dl-touch flex-1 border-l border-dl-grid-line px-2 font-dl-mono text-dl-label uppercase tracking-wide transition-colors first:border-l-0 md:min-h-[38px]"
          :class="recurrenceType === t.value ? 'bg-dl-violet text-white' : 'bg-dl-surface text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink'"
          @click="recurrenceType = t.value"
        >{{ t.label }}</button>
      </div>
    </div>

    <!-- Dependent control slot: fixed min-height so the footer never moves between types. -->
    <div class="flex min-h-[68px] flex-col justify-center">
      <label v-if="recurrenceType === 'every_x_days'" class="flex flex-col gap-1.5">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Interval</span>
        <div class="flex items-center gap-3">
          <input
            v-model.number="everyXDays"
            type="number"
            min="1"
            class="dl-focus-inset w-24 border border-dl-grid-line bg-dl-surface px-3 py-2 font-dl-mono text-dl-body text-dl-ink outline-none"
          />
          <span class="text-dl-meta text-dl-ink-muted">days between completions</span>
        </div>
      </label>
      <div v-else-if="recurrenceType === 'weekdays'" class="flex flex-wrap gap-2">
        <button
          v-for="(day, i) in WEEKDAYS"
          :key="day"
          type="button"
          :aria-pressed="selectedDays[i]"
          class="dl-focus-inset min-h-dl-touch min-w-[3rem] flex-1 border font-dl-mono text-dl-label uppercase tracking-wide transition-colors md:min-h-[38px]"
          :class="selectedDays[i] ? 'border-dl-violet bg-dl-violet text-white' : 'border-dl-grid-line bg-dl-surface text-dl-ink-muted hover:bg-dl-sunk'"
          @click="selectedDays[i] = !selectedDays[i]"
        >{{ day }}</button>
      </div>
      <p v-else class="m-0 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-faint">Daily needs no further control</p>
    </div>

    <p class="m-0 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">{{ RECURRING_XP_REWARD }} XP per completion · fixed</p>

    <!-- Editing the schedule doesn't rewrite recorded history. -->
    <p v-if="mode === 'edit'" class="m-0 flex gap-2 border border-dl-gold bg-dl-gold/10 px-3 py-2 text-dl-meta text-dl-ink">
      <span aria-hidden="true" class="text-dl-gold">!</span>
      Changing the schedule does not rewrite history. Past days keep the state they were recorded with; the new schedule applies from today forward.
    </p>

    <p v-if="errorMsg" class="m-0 text-dl-meta text-dl-magenta">{{ errorMsg }}</p>

    <div class="sticky bottom-0 -mx-5 -mb-5 mt-1 flex items-center justify-end gap-3 border-t border-dl-band-line bg-dl-surface px-5 py-3">
      <button
        v-if="mode === 'edit'"
        type="button"
        :disabled="submitting"
        class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink disabled:opacity-60"
        @click="emit('cancel')"
      >Cancel</button>
      <button
        type="submit"
        :disabled="submitting"
        class="dl-focus-inset cursor-pointer bg-dl-violet px-5 py-2 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
      >{{ submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create ritual' }}</button>
    </div>
  </form>
</template>
