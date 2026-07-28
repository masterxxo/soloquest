<script setup lang="ts">
import { client, type Quest, type QuestWithWarnings, type QuestTag } from '~/lib/api-client';
import { useQuestsStore } from '~/stores/quests';
import { localDateString } from '~/lib/date';
import { XP_REWARDS, type Difficulty, type QuestPriority } from '@soloquest/shared';
import { PRIORITY_DISPLAY_ORDER, PRIORITY_STYLES, PRIORITY_DL_CLASS } from '~/lib/priority';

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
const priority = ref<QuestPriority>('normal');
const deadline = ref('');
const parentId = ref('');
const selectedTags = ref<QuestTag[]>([]);
const submitting = ref(false);
const errorMsg = ref<string | null>(null);
const localWarnings = ref<string[]>([]);

const { activeQuests } = storeToRefs(useQuestsStore());
const parentChoices = computed(() =>
  activeQuests.value.filter((q) => props.mode !== 'edit' || q.id !== props.initial?.id),
);
const xpForSelected = computed(() => XP_REWARDS[difficulty.value]);

function toDateInput(iso: string) {
  return localDateString(new Date(iso));
}

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
  if (deadline.value !== initialDeadline) changes.deadline = deadline.value ? new Date(deadline.value) : null;
  if (parentId.value !== (initial.parentId ?? '')) changes.parentId = parentId.value || null;
  const initialTagIds = new Set((initial.tags ?? []).map((t) => t.id));
  const currentTagIds = selectedTags.value.map((t) => t.id);
  const tagsChanged = initialTagIds.size !== currentTagIds.length || currentTagIds.some((id) => !initialTagIds.has(id));
  if (tagsChanged) changes.tagIds = currentTagIds;

  if (Object.keys(changes).length === 0) {
    emit('cancel');
    return;
  }
  const res = await client.api.quests[':id'].$patch({ param: { id: initial.id }, json: changes });
  if (!res.ok) {
    errorMsg.value = res.status === 409 ? 'This quest can no longer be edited.' : 'Could not save changes.';
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
  <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
    <label class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Title</span>
      <input
        v-model="title"
        type="text"
        placeholder="Title"
        required
        maxlength="255"
        class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint"
      />
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Description</span>
      <textarea
        v-model="description"
        placeholder="Description"
        required
        rows="2"
        class="dl-focus-inset resize-y border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint"
      />
    </label>

    <div class="flex flex-wrap gap-5">
      <div class="flex flex-col gap-1.5">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Rank · {{ xpForSelected }} XP</span>
        <RankSelector :selected="[difficulty]" label="Rank" @toggle="difficulty = $event" />
      </div>
      <label class="flex flex-1 flex-col gap-1.5">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Deadline</span>
        <input
          v-model="deadline"
          type="date"
          class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none"
        />
      </label>
    </div>

    <p v-for="(w, i) in localWarnings" :key="i" class="m-0 flex gap-2 border border-dl-gold bg-dl-gold/10 px-3 py-2 text-dl-meta text-dl-ink"><span aria-hidden="true" class="text-dl-gold">!</span>{{ w }}</p>

    <div class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Priority</span>
      <div role="group" aria-label="Priority" class="inline-flex overflow-hidden border border-dl-grid-line">
        <button
          v-for="p in PRIORITY_DISPLAY_ORDER"
          :key="p"
          type="button"
          :aria-pressed="priority === p"
          class="dl-focus-inset flex min-h-dl-touch flex-1 items-center justify-center gap-1.5 border-l border-dl-grid-line px-3 font-dl-mono text-dl-label uppercase tracking-wide transition-colors first:border-l-0 md:min-h-[38px]"
          :class="priority === p ? 'bg-dl-violet text-white' : 'bg-dl-surface text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink'"
          @click="priority = p"
        >
          <span :class="priority === p ? 'text-white' : PRIORITY_DL_CLASS[p]" aria-hidden="true">{{ PRIORITY_STYLES[p].glyph }}</span>
          {{ PRIORITY_STYLES[p].short }}
        </button>
      </div>
    </div>

    <label class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Parent quest</span>
      <select
        v-model="parentId"
        class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none"
      >
        <option value="">None</option>
        <option v-for="q in parentChoices" :key="q.id" :value="q.id">{{ q.title }}</option>
      </select>
    </label>

    <QuestTagPicker v-model="selectedTags" />

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
      >{{ submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create quest' }}</button>
    </div>
  </form>
</template>
