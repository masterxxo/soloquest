<script setup lang="ts">
import { client, type Quest, type Campaign, type QuestWithWarnings } from '~/lib/api-client';
import { XP_REWARDS } from '@soloquest/shared';

const props = withDefaults(
  defineProps<{ mode?: 'create' | 'edit'; initial?: Quest | null }>(),
  { mode: 'create', initial: null },
);
const emit = defineEmits<{
  created: [result: QuestWithWarnings];
  updated: [result: QuestWithWarnings];
  cancel: [];
}>();

const DIFFICULTIES = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const title = ref('');
const description = ref('');
const difficulty = ref<Difficulty>('E');
const deadline = ref(''); // yyyy-mm-dd from <input type="date">
const campaignId = ref(''); // '' = None (sent as null)
const parentId = ref(''); // '' = None (sent as null)
const submitting = ref(false);
const errorMsg = ref<string | null>(null);
// Rank warnings from the last server response (non-blocking; shown under difficulty).
const localWarnings = ref<string[]>([]);

// Options for the two relation selects, fetched client-side on mount.
const campaigns = ref<Campaign[]>([]);
const activeQuests = ref<Quest[]>([]);
// In edit mode a quest can't be its own parent.
const parentChoices = computed(() =>
  activeQuests.value.filter((q) => props.mode !== 'edit' || q.id !== props.initial?.id),
);

// XP reward for the selected rank — read from shared, never hardcoded.
const xpForSelected = computed(() => XP_REWARDS[difficulty.value]);

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

onMounted(async () => {
  const [cRes, qRes] = await Promise.all([
    client.api.campaigns.$get(),
    client.api.quests.$get({ query: { status: 'active' } }),
  ]);
  if (cRes.ok) campaigns.value = await cRes.json();
  if (qRes.ok) activeQuests.value = await qRes.json();
});

// Prefill from `initial` (edit mode); re-syncs if the target quest changes.
watch(
  () => props.initial,
  (q) => {
    title.value = q?.title ?? '';
    description.value = q?.description ?? '';
    difficulty.value = q?.difficulty ?? 'E';
    deadline.value = q?.deadline ? toDateInput(q.deadline) : '';
    campaignId.value = q?.campaignId ?? '';
    parentId.value = q?.parentId ?? '';
  },
  { immediate: true },
);

async function onCreate() {
  const res = await client.api.quests.$post({
    json: {
      title: title.value,
      description: description.value,
      difficulty: difficulty.value,
      // Date or null (empty = no deadline). hc serialises the Date to ISO; null stays
      // null. Never send "" — z.coerce.date() would choke on it.
      deadline: deadline.value ? new Date(deadline.value) : null,
      campaignId: campaignId.value || null,
      parentId: parentId.value || null,
    },
  });
  if (!res.ok) {
    errorMsg.value = 'Could not create quest. Check the fields and try again.';
    return;
  }
  const result = await res.json();
  localWarnings.value = result.warnings;
  emit('created', result);
  title.value = '';
  description.value = '';
  difficulty.value = 'E';
  deadline.value = '';
  campaignId.value = '';
  parentId.value = '';
}

async function onEdit() {
  const initial = props.initial!;
  // Send only changed fields. xpReward/status are never sent — the server owns them.
  const changes: {
    title?: string;
    description?: string;
    difficulty?: Difficulty;
    deadline?: Date | null;
    campaignId?: string | null;
    parentId?: string | null;
  } = {};
  if (title.value !== initial.title) changes.title = title.value;
  if (description.value !== (initial.description ?? '')) changes.description = description.value;
  if (difficulty.value !== initial.difficulty) changes.difficulty = difficulty.value;
  const initialDeadline = initial.deadline ? toDateInput(initial.deadline) : '';
  // Empty now → null (clear it); set/changed → Date; unchanged → omit.
  if (deadline.value !== initialDeadline) changes.deadline = deadline.value ? new Date(deadline.value) : null;
  if (campaignId.value !== (initial.campaignId ?? '')) changes.campaignId = campaignId.value || null;
  if (parentId.value !== (initial.parentId ?? '')) changes.parentId = parentId.value || null;

  if (Object.keys(changes).length === 0) {
    emit('cancel');
    return;
  }

  const res = await client.api.quests[':id'].$patch({ param: { id: initial.id }, json: changes });
  if (!res.ok) {
    errorMsg.value =
      res.status === 409 ? 'This quest can no longer be edited.' : 'Could not save changes.';
    return;
  }
  const result = await res.json();
  localWarnings.value = result.warnings;
  emit('updated', result);
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
  <form class="quest-form" @submit.prevent="onSubmit">
    <p class="tag">{{ mode === 'edit' ? '[ EDIT QUEST ]' : '[ NEW QUEST ]' }}</p>

    <input v-model="title" type="text" placeholder="Title" required maxlength="255" />
    <textarea v-model="description" placeholder="Description" required rows="2" />

    <div class="row">
      <label>
        Rank — {{ xpForSelected }} XP
        <select v-model="difficulty">
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }} — {{ XP_REWARDS[d] }} XP</option>
        </select>
      </label>
      <label>
        Deadline
        <input v-model="deadline" type="date" />
      </label>
    </div>

    <p v-for="(w, i) in localWarnings" :key="i" class="rank-warning">⚠ {{ w }}</p>

    <div class="row">
      <label>
        Campaign
        <select v-model="campaignId">
          <option value="">None</option>
          <option v-for="c in campaigns" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
      </label>
      <label>
        Parent quest
        <select v-model="parentId">
          <option value="">None</option>
          <option v-for="q in parentChoices" :key="q.id" :value="q.id">{{ q.title }}</option>
        </select>
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
.row label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #8174b8;
}
.rank-warning { margin: 0; font-size: 0.78rem; color: #f0b429; }
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
