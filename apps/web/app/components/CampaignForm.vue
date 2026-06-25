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
  <form class="campaign-form" @submit.prevent="onSubmit">
    <p class="tag">{{ mode === 'edit' ? '[ EDIT CAMPAIGN ]' : '[ NEW CAMPAIGN ]' }}</p>

    <input v-model="title" type="text" placeholder="Title" required maxlength="255" />
    <textarea v-model="description" placeholder="Description (optional)" rows="2" />

    <div class="row">
      <label>
        Rank
        <select v-model="difficulty">
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label>
        Deadline
        <input v-model="deadline" type="date" />
      </label>
    </div>

    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

    <div class="form-actions">
      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create campaign' }}
      </button>
      <button
        v-if="mode === 'edit'"
        type="button"
        class="cancel"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>

<style scoped>
.campaign-form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
}
.tag { margin: 0; letter-spacing: 0.3em; font-size: 0.7rem; color: #7c5ce8; }
input, textarea, select {
  padding: 0.55rem 0.7rem;
  background: #0a0618;
  border: 1px solid #2a2050;
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
.row label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #8174b8;
}
.err { margin: 0; font-size: 0.78rem; color: #ff8080; }
.form-actions { display: flex; gap: 0.6rem; }
button {
  padding: 0.6rem;
  flex: 1;
  background: linear-gradient(180deg, #6a4fd8, #4a35a8);
  border: none;
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
