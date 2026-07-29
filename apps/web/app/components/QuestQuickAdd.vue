<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { client, type QuestWithWarnings, type QuestTag } from '~/lib/api-client';
import { readApiError } from '~/lib/api-error';
import { useFeedbackStore } from '~/stores/feedback';
import { useTagsStore } from '~/stores/tags';
import { useTagCombobox } from '~/composables/useTagCombobox';
import { useAnchoredList } from '~/composables/useAnchoredList';
import { tagSwatchStyle } from '~/lib/tag-colors';
import { normalizeTagName, TAG_NAME_MAX_LENGTH, type Difficulty } from '@soloquest/shared';

// Inline quick-add: a title-only field at rest that expands to the full capture (rank E–S, a
// deadline, and tags) on focus, then posts a real quest. It owns its own POST and emits the
// created quest for the page to fold into the store — the same shape the New Quest modal emits.
// The heavier fields (description, parent, sub-tasks) stay in that modal; this is the fast path.
const emit = defineEmits<{ created: [result: QuestWithWarnings] }>();

const feedback = useFeedbackStore();

const title = ref('');
const difficulty = ref<Difficulty>('E');
const deadline = ref(''); // yyyy-mm-dd from <input type="date">; '' = no deadline
const selectedTags = ref<QuestTag[]>([]);
const expanded = ref(false);
const submitting = ref(false);
const titleEl = ref<HTMLInputElement | null>(null);

function expand() {
  expanded.value = true;
}

// Collapse back to the resting field, discarding the in-progress capture. Only auto-collapses
// when nothing has been entered, so a stray blur can't wipe a half-typed quest.
function collapse() {
  expanded.value = false;
  title.value = '';
  difficulty.value = 'E';
  deadline.value = '';
  selectedTags.value = [];
}
function onTitleBlur() {
  if (!title.value.trim() && !selectedTags.value.length && !deadline.value) expanded.value = false;
}

async function submit() {
  const trimmed = title.value.trim();
  if (!trimmed || submitting.value) return;
  submitting.value = true;
  try {
    const res = await client.api.quests.$post({
      json: {
        title: trimmed,
        description: trimmed, // mirrors the title; the full form is where a real description lives
        difficulty: difficulty.value,
        deadline: deadline.value ? new Date(deadline.value) : null,
        tagIds: selectedTags.value.map((t) => t.id),
      },
    });
    if (!res.ok) {
      const { message } = await readApiError(res, 'Could not create quest.');
      feedback.showError(message);
      return;
    }
    emit('created', await res.json());
    collapse();
    nextTick(() => titleEl.value?.focus());
  } finally {
    submitting.value = false;
  }
}

// ── Tag combobox (Daylight) — search/create/pin, mirroring QuestTagPicker's behaviour ────────
const tagsStore = useTagsStore();
const { sortedTags } = storeToRefs(tagsStore);
onMounted(() => { tagsStore.load(); });

const tagQuery = ref('');
const creatingTag = ref(false);
const tagInputEl = ref<HTMLInputElement | null>(null);
const tagFieldEl = ref<HTMLElement | null>(null);
const listboxId = useId();

const selectedTagIds = computed(() => new Set(selectedTags.value.map((t) => t.id)));
const normalizedQuery = computed(() => normalizeTagName(tagQuery.value));

const tagMatches = computed(() =>
  sortedTags.value.filter(
    (t) =>
      !selectedTagIds.value.has(t.id) &&
      (normalizedQuery.value === '' || t.normalizedName.includes(normalizedQuery.value)),
  ),
);
const canCreate = computed(
  () =>
    normalizedQuery.value.length > 0 &&
    !sortedTags.value.some((t) => t.normalizedName === normalizedQuery.value),
);

type Option = { kind: 'tag'; tag: QuestTag } | { kind: 'create'; label: string };
const options = computed<Option[]>(() => {
  const opts: Option[] = tagMatches.value.map((t) => ({
    kind: 'tag',
    tag: { id: t.id, name: t.name, color: t.color },
  }));
  if (canCreate.value) opts.push({ kind: 'create', label: tagQuery.value.trim() });
  return opts;
});

function pin(tag: QuestTag) {
  if (!selectedTagIds.value.has(tag.id)) selectedTags.value = [...selectedTags.value, tag];
}
function removeTag(id: string) {
  selectedTags.value = selectedTags.value.filter((t) => t.id !== id);
}
async function chooseCreate(label: string) {
  if (creatingTag.value) return;
  creatingTag.value = true;
  try {
    const tag = await tagsStore.createTag(label);
    if (tag) pin({ id: tag.id, name: tag.name, color: tag.color });
    tagQuery.value = '';
  } finally {
    creatingTag.value = false;
    tagInputEl.value?.focus();
  }
}
function choose(option: Option) {
  if (option.kind === 'tag') {
    pin(option.tag);
    tagQuery.value = '';
    tagInputEl.value?.focus();
  } else {
    void chooseCreate(option.label);
  }
}

const { open, activeIndex, openList, onKeydown } = useTagCombobox<Option>({
  query: tagQuery,
  options,
  select: choose,
  backspaceOnEmpty: () => {
    if (selectedTags.value.length > 0) removeTag(selectedTags.value[selectedTags.value.length - 1]!.id);
  },
});
function onTagBlur() {
  open.value = false;
}
const { anchoredStyle } = useAnchoredList(tagFieldEl, open);
const optionId = (i: number) => `${listboxId}-opt-${i}`;
watch(activeIndex, (i) => {
  if (!open.value || !import.meta.client) return;
  nextTick(() => document.getElementById(optionId(i))?.scrollIntoView({ block: 'nearest' }));
});
</script>

<template>
  <form class="border border-dl-grid-line bg-dl-surface" @submit.prevent="submit">
    <!-- Resting / title row. -->
    <div class="flex h-dl-row items-center gap-2 px-3">
      <span class="shrink-0 text-dl-ink-faint" aria-hidden="true">+</span>
      <input
        ref="titleEl"
        v-model="title"
        type="text"
        maxlength="255"
        placeholder="Add a quest…"
        class="min-w-0 flex-1 border-0 bg-transparent p-0 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint"
        @focus="expand"
        @blur="onTitleBlur"
      />
      <span v-if="!expanded" class="shrink-0 font-dl-mono text-dl-label text-dl-ink-faint" aria-hidden="true">⏎</span>
    </div>

    <!-- Active detail row. -->
    <div v-if="expanded" class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dl-hairline px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Rank</span>
        <RankSelector :selected="[difficulty]" label="Rank" @toggle="difficulty = $event" />
      </div>

      <input
        v-model="deadline"
        type="date"
        aria-label="Deadline"
        class="dl-focus-inset min-h-dl-touch border border-dl-grid-line bg-dl-surface px-2 py-1 font-dl-mono text-dl-meta text-dl-ink outline-none md:min-h-0"
      />

      <!-- Tag combobox. -->
      <div
        ref="tagFieldEl"
        class="flex min-w-[9rem] flex-1 flex-wrap items-center gap-1 border border-dl-grid-line bg-dl-surface px-2 py-1 focus-within:border-dl-violet"
        @click="tagInputEl?.focus()"
      >
        <TagChip
          v-for="tag in selectedTags"
          :key="tag.id"
          :name="tag.name"
          :color="tag.color"
          removable
          @remove="removeTag(tag.id)"
        />
        <input
          ref="tagInputEl"
          v-model="tagQuery"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="open"
          :aria-controls="listboxId"
          :aria-activedescendant="open && options.length ? optionId(activeIndex) : undefined"
          :maxlength="TAG_NAME_MAX_LENGTH"
          :placeholder="selectedTags.length ? '' : '+ Tag'"
          class="min-w-[4rem] flex-1 border-0 bg-transparent p-0 text-dl-meta text-dl-ink outline-none placeholder:text-dl-ink-faint"
          @focus="openList"
          @input="openList"
          @keydown="onKeydown"
          @blur="onTagBlur"
        />
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-1.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted transition-colors hover:bg-dl-sunk hover:text-dl-ink"
          @click="collapse"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="submitting || !title.trim()"
          class="dl-focus-inset cursor-pointer bg-dl-violet px-4 py-1.5 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? '…' : 'Add' }}
        </button>
      </div>
    </div>

    <!-- Tag suggestion list — teleported + fixed (via useAnchoredList) so it never grows the row. -->
    <Teleport to="body">
      <ul
        v-if="open && options.length"
        :id="listboxId"
        role="listbox"
        :style="anchoredStyle"
        class="z-[55] m-0 flex list-none flex-col overflow-y-auto border border-dl-grid-line bg-dl-surface p-1 shadow-[0_8px_24px_rgba(20,17,31,0.15)]"
        @mousedown.prevent
      >
        <li
          v-for="(option, i) in options"
          :id="optionId(i)"
          :key="option.kind === 'tag' ? option.tag.id : 'create'"
          role="option"
          :aria-selected="i === activeIndex"
          class="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-dl-meta"
          :class="i === activeIndex ? 'bg-dl-violet-wash text-dl-ink' : 'text-dl-ink-muted hover:bg-dl-sunk'"
          @mousedown.prevent="choose(option)"
          @mouseenter="activeIndex = i"
        >
          <template v-if="option.kind === 'tag'">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="tagSwatchStyle(option.tag.color)" />
            {{ option.tag.name }}
          </template>
          <template v-else>
            <span class="text-dl-ink-faint">Create</span> "{{ option.label }}"
          </template>
        </li>
      </ul>
    </Teleport>
  </form>
</template>
