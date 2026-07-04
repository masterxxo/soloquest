<script setup lang="ts">
import { client, type Quest, type QuestWithWarnings } from '~/lib/api-client';
import { XP_REWARDS, DIFFICULTY_ORDER, type Difficulty } from '@soloquest/shared';

const props = withDefaults(
  defineProps<{ mode?: 'create' | 'edit'; initial?: Quest | null }>(),
  { mode: 'create', initial: null },
);
const emit = defineEmits<{
  created: [result: QuestWithWarnings];
  updated: [result: QuestWithWarnings];
  cancel: [];
}>();

const title = ref('');
const description = ref('');
const difficulty = ref<Difficulty>('E');
const deadline = ref(''); // yyyy-mm-dd from <input type="date">
const parentId = ref(''); // '' = None (sent as null)
const submitting = ref(false);
const errorMsg = ref<string | null>(null);
// Rank warnings from the last server response (non-blocking; shown under difficulty).
const localWarnings = ref<string[]>([]);

// Options for the parent-quest select, fetched client-side on mount.
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
  const qRes = await client.api.quests.$get({ query: { status: 'active' } });
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
    parentId?: string | null;
  } = {};
  if (title.value !== initial.title) changes.title = title.value;
  if (description.value !== (initial.description ?? '')) changes.description = description.value;
  if (difficulty.value !== initial.difficulty) changes.difficulty = difficulty.value;
  const initialDeadline = initial.deadline ? toDateInput(initial.deadline) : '';
  // Empty now → null (clear it); set/changed → Date; unchanged → omit.
  if (deadline.value !== initialDeadline) changes.deadline = deadline.value ? new Date(deadline.value) : null;
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
  <form class="flex flex-col gap-[0.7rem] rounded-none border border-line bg-[rgba(14,9,30,0.6)] p-4" @submit.prevent="onSubmit">
    <p class="m-0 text-[0.7rem] tracking-[0.3em] text-accent">{{ mode === 'edit' ? '[ EDIT QUEST ]' : '[ NEW QUEST ]' }}</p>

    <input
      v-model="title"
      type="text"
      placeholder="Title"
      required
      maxlength="255"
      class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
    />
    <textarea
      v-model="description"
      placeholder="Description"
      required
      rows="2"
      class="resize-y rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
    />

    <div class="flex gap-[0.7rem]">
      <label class="flex flex-1 flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
        Rank — {{ xpForSelected }} XP
        <select
          v-model="difficulty"
          class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
        >
          <option v-for="d in DIFFICULTY_ORDER" :key="d" :value="d">{{ d }} — {{ XP_REWARDS[d] }} XP</option>
        </select>
      </label>
      <label class="flex flex-1 flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
        Deadline
        <input
          v-model="deadline"
          type="date"
          class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
        />
      </label>
    </div>

    <p v-for="(w, i) in localWarnings" :key="i" class="m-0 text-[0.78rem] text-gold">⚠ {{ w }}</p>

    <label class="flex flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
      Parent quest
      <select
        v-model="parentId"
        class="rounded-none border border-line bg-panel px-[0.7rem] py-[0.55rem] text-[0.9rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
      >
        <option value="">None</option>
        <option v-for="q in parentChoices" :key="q.id" :value="q.id">{{ q.title }}</option>
      </select>
    </label>

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
