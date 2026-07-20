<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { client, type Quest, type QuestWithWarnings, type QuestTag } from '~/lib/api-client';
import { useQuestsStore } from '~/stores/quests';
import { localDateString } from '~/lib/date';
import { XP_REWARDS, DIFFICULTY_ORDER, type Difficulty, type QuestPriority } from '@soloquest/shared';
import { PRIORITY_DISPLAY_ORDER, PRIORITY_STYLES } from '~/lib/priority';

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
const priority = ref<QuestPriority>('normal'); // default on create
const deadline = ref(''); // yyyy-mm-dd from <input type="date">
const parentId = ref(''); // '' = None (sent as null)
const selectedTags = ref<QuestTag[]>([]); // tag pins, sent as tagIds
const submitting = ref(false);
const errorMsg = ref<string | null>(null);
// Rank warnings from the last server response (non-blocking; shown under difficulty).
const localWarnings = ref<string[]>([]);

// Parent-quest options come from the shared store (single source of active quests);
// the picker only needs id/title, which the store list carries.
const { activeQuests } = storeToRefs(useQuestsStore());
// In edit mode a quest can't be its own parent.
const parentChoices = computed(() =>
  activeQuests.value.filter((q) => props.mode !== 'edit' || q.id !== props.initial?.id),
);

// XP reward for the selected rank — read from shared, never hardcoded.
const xpForSelected = computed(() => XP_REWARDS[difficulty.value]);

// Local calendar day (never toISOString — that shifts by the UTC offset and can land
// the deadline on the wrong day).
function toDateInput(iso: string) {
  return localDateString(new Date(iso));
}

// Prefill from `initial` (edit mode); re-syncs if the target quest changes.
watch(
  () => props.initial,
  (q) => {
    title.value = q?.title ?? '';
    description.value = q?.description ?? '';
    difficulty.value = q?.difficulty ?? 'E';
    priority.value = q?.priority ?? 'normal';
    deadline.value = q?.deadline ? toDateInput(q.deadline) : '';
    parentId.value = q?.parentId ?? '';
    selectedTags.value = q?.tags ? q.tags.map((t) => ({ ...t })) : [];
  },
  { immediate: true },
);

async function onCreate() {
  const res = await client.api.quests.$post({
    json: {
      title: title.value,
      description: description.value,
      difficulty: difficulty.value,
      priority: priority.value,
      // Date or null (empty = no deadline). hc serialises the Date to ISO; null stays
      // null. Never send "" — z.coerce.date() would choke on it.
      deadline: deadline.value ? new Date(deadline.value) : null,
      parentId: parentId.value || null,
      tagIds: selectedTags.value.map((t) => t.id),
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
  priority.value = 'normal';
  deadline.value = '';
  parentId.value = '';
  selectedTags.value = [];
}

async function onEdit() {
  const initial = props.initial!;
  // Send only changed fields. xpReward/status are never sent — the server owns them.
  const changes: {
    title?: string;
    description?: string;
    difficulty?: Difficulty;
    priority?: QuestPriority;
    deadline?: Date | null;
    parentId?: string | null;
    tagIds?: string[];
  } = {};
  if (title.value !== initial.title) changes.title = title.value;
  if (description.value !== (initial.description ?? '')) changes.description = description.value;
  if (difficulty.value !== initial.difficulty) changes.difficulty = difficulty.value;
  if (priority.value !== initial.priority) changes.priority = priority.value;
  const initialDeadline = initial.deadline ? toDateInput(initial.deadline) : '';
  // Empty now → null (clear it); set/changed → Date; unchanged → omit.
  if (deadline.value !== initialDeadline) changes.deadline = deadline.value ? new Date(deadline.value) : null;
  if (parentId.value !== (initial.parentId ?? '')) changes.parentId = parentId.value || null;
  // Send tagIds only when the set actually changed (order-insensitive), so a no-op edit stays
  // a no-op. A present array — even empty — means "replace with exactly this" server-side.
  const initialTagIds = new Set((initial.tags ?? []).map((t) => t.id));
  const currentTagIds = selectedTags.value.map((t) => t.id);
  const tagsChanged =
    initialTagIds.size !== currentTagIds.length || currentTagIds.some((id) => !initialTagIds.has(id));
  if (tagsChanged) changes.tagIds = currentTagIds;

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

    <!-- Priority: a segmented control (native buttons → keyboard-accessible), matching the
         card marker's glyphs. Default 'normal' on create. One compact row, not a section. -->
    <div class="flex flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
      <span>Priority</span>
      <div role="group" aria-label="Priority" class="grid grid-cols-3 gap-[0.3rem]">
        <button
          v-for="p in PRIORITY_DISPLAY_ORDER"
          :key="p"
          type="button"
          :aria-pressed="priority === p"
          class="flex items-center justify-center gap-[0.35rem] rounded-none border px-[0.5rem] py-[0.4rem] text-[0.8rem] font-semibold font-[inherit] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
          :class="priority === p ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink-dim hover:border-line-soft hover:text-ink'"
          @click="priority = p"
        >
          <span :class="PRIORITY_STYLES[p].klass" aria-hidden="true">{{ PRIORITY_STYLES[p].glyph }}</span>
          {{ PRIORITY_STYLES[p].short }}
        </button>
      </div>
    </div>

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

    <QuestTagPicker v-model="selectedTags" />

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
