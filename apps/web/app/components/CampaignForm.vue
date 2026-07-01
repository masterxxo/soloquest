<script setup lang="ts">
import {
  client,
  type Campaign,
  type CampaignDetail,
  type CampaignRow,
} from '~/lib/api-client';

const props = withDefaults(
  defineProps<{ mode?: 'create' | 'edit'; initial?: Campaign | CampaignDetail | null }>(),
  { mode: 'create', initial: null },
);
const emit = defineEmits<{
  created: [campaign: CampaignRow];
  updated: [campaign: CampaignRow];
  cancel: [];
}>();

const DIFFICULTIES = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const title = ref('');
const description = ref('');
const difficulty = ref<Difficulty>('E');
const deadline = ref(''); // yyyy-mm-dd from <input type="date">
const submitting = ref(false);
const errorMsg = ref<string | null>(null);

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

// Prefill from `initial` (edit mode); re-syncs if the target campaign changes.
watch(
  () => props.initial,
  (c) => {
    title.value = c?.title ?? '';
    description.value = c?.description ?? '';
    difficulty.value = c?.difficulty ?? 'E';
    deadline.value = c?.deadline ? toDateInput(c.deadline) : '';
  },
  { immediate: true },
);

async function onCreate() {
  const res = await client.api.campaigns.$post({
    json: {
      title: title.value,
      difficulty: difficulty.value,
      description: description.value || undefined,
      // Date or null (empty = no deadline). Never send "" — z.coerce.date() chokes on it.
      deadline: deadline.value ? new Date(deadline.value) : null,
    },
  });
  if (!res.ok) {
    errorMsg.value = 'Could not create campaign. Check the fields and try again.';
    return;
  }
  emit('created', await res.json());
  title.value = '';
  description.value = '';
  difficulty.value = 'E';
  deadline.value = '';
}

async function onEdit() {
  const initial = props.initial!;
  // Send only changed fields. status is never sent here — Complete owns that.
  const changes: {
    title?: string;
    description?: string;
    difficulty?: Difficulty;
    deadline?: Date | null;
  } = {};
  if (title.value !== initial.title) changes.title = title.value;
  if (description.value !== (initial.description ?? '')) changes.description = description.value;
  if (difficulty.value !== initial.difficulty) changes.difficulty = difficulty.value;
  const initialDeadline = initial.deadline ? toDateInput(initial.deadline) : '';
  // Empty now → null (clear it); set/changed → Date; unchanged → omit.
  if (deadline.value !== initialDeadline)
    changes.deadline = deadline.value ? new Date(deadline.value) : null;

  if (Object.keys(changes).length === 0) {
    emit('cancel');
    return;
  }

  const res = await client.api.campaigns[':id'].$patch({
    param: { id: initial.id },
    json: changes,
  });
  if (!res.ok) {
    errorMsg.value =
      res.status === 409 ? 'This campaign can no longer be edited.' : 'Could not save changes.';
    return;
  }
  emit('updated', await res.json());
}

async function onSubmit() {
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
  <form class="flex flex-col gap-[0.7rem] border border-line bg-[rgba(14,9,30,0.6)] p-4" @submit.prevent="onSubmit">
    <p class="m-0 text-[0.7rem] tracking-[0.3em] text-accent">{{ mode === 'edit' ? '[ EDIT CAMPAIGN ]' : '[ NEW CAMPAIGN ]' }}</p>

    <input
      v-model="title"
      type="text"
      placeholder="Title"
      required
      maxlength="255"
      class="border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
    />
    <textarea
      v-model="description"
      placeholder="Description (optional)"
      rows="2"
      class="resize-y border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
    />

    <div class="flex gap-[0.7rem]">
      <label class="flex flex-1 flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
        Rank
        <select
          v-model="difficulty"
          class="border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
        >
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label class="flex flex-1 flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
        Deadline
        <input
          v-model="deadline"
          type="date"
          class="border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
        />
      </label>
    </div>

    <p v-if="errorMsg" class="m-0 text-[0.78rem] text-danger-bright">{{ errorMsg }}</p>

    <div class="flex gap-[0.6rem]">
      <button
        type="submit"
        :disabled="submitting"
        class="flex-1 cursor-pointer border-0 bg-gradient-to-b from-accent-deep to-accent-dark p-[0.6rem] font-semibold text-white shadow-[0_0_14px_rgba(124,92,232,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create campaign' }}
      </button>
      <button
        v-if="mode === 'edit'"
        type="button"
        :disabled="submitting"
        class="flex-none cursor-pointer border border-line bg-transparent p-[0.6rem] font-semibold text-ink shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
