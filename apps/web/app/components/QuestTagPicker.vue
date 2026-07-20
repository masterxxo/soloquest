<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useTagsStore } from '~/stores/tags';
import { useTagCombobox } from '~/composables/useTagCombobox';
import { useAnchoredList } from '~/composables/useAnchoredList';
import { normalizeTagName, TAG_NAME_MAX_LENGTH } from '@soloquest/shared';
import { tagChipStyle, tagSwatchStyle } from '~/lib/tag-colors';
import type { QuestTag } from '~/lib/api-client';

// Todoist-style tag combobox: search existing tags, pick with mouse or keyboard, or create
// a new one on the fly without leaving the form. The selected set is a v-model of the quest
// form; creation goes through the shared tags store (POST /api/tags, create-or-return). The
// open/highlight/keyboard state is the shared useTagCombobox, so this matches the filter popover.
const selected = defineModel<QuestTag[]>({ required: true });

const tagsStore = useTagsStore();
const { sortedTags } = storeToRefs(tagsStore);
onMounted(() => { tagsStore.load(); });

const query = ref('');
const creating = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);
const fieldEl = ref<HTMLElement | null>(null);
const listboxId = useId();

const selectedIds = computed(() => new Set(selected.value.map((t) => t.id)));
const normalizedQuery = computed(() => normalizeTagName(query.value));

// Existing tags matching the query (case-insensitive contains on the normalized name) and
// not already pinned. `contains`, so "om" surfaces "Dom".
const matches = computed(() =>
  sortedTags.value.filter(
    (t) =>
      !selectedIds.value.has(t.id) &&
      (normalizedQuery.value === '' || t.normalizedName.includes(normalizedQuery.value)),
  ),
);

// Offer "Create" only when the typed text is non-empty and doesn't already exist as a tag
// (matched on normalized name, across the whole set — even an already-pinned one blocks a dup).
const canCreate = computed(
  () =>
    normalizedQuery.value.length > 0 &&
    !sortedTags.value.some((t) => t.normalizedName === normalizedQuery.value),
);

// The navigable option list: existing matches, then the synthetic "create" row when offered.
type Option =
  | { kind: 'tag'; tag: QuestTag }
  | { kind: 'create'; label: string };
const options = computed<Option[]>(() => {
  const opts: Option[] = matches.value.map((t) => ({
    kind: 'tag',
    tag: { id: t.id, name: t.name, color: t.color },
  }));
  if (canCreate.value) opts.push({ kind: 'create', label: query.value.trim() });
  return opts;
});

function pin(tag: QuestTag) {
  if (!selectedIds.value.has(tag.id)) selected.value = [...selected.value, tag];
}
function removeTag(id: string) {
  selected.value = selected.value.filter((t) => t.id !== id);
}

async function chooseCreate(label: string) {
  if (creating.value) return;
  creating.value = true;
  try {
    const tag = await tagsStore.createTag(label);
    if (tag) pin({ id: tag.id, name: tag.name, color: tag.color });
    query.value = '';
  } finally {
    creating.value = false;
    inputEl.value?.focus();
  }
}

function choose(option: Option) {
  if (option.kind === 'tag') {
    pin(option.tag);
    query.value = '';
    inputEl.value?.focus();
  } else {
    void chooseCreate(option.label);
  }
}

const { open, activeIndex, openList, onKeydown } = useTagCombobox<Option>({
  query,
  options,
  select: choose,
  backspaceOnEmpty: () => {
    if (selected.value.length > 0) removeTag(selected.value[selected.value.length - 1]!.id);
  },
});

function onBlur() {
  // Options keep focus via @mousedown.prevent, so a real blur means focus left the widget.
  open.value = false;
}

// The list is a fixed-position layer teleported to <body>, anchored to the field box — so
// opening it never grows the form/modal, and the modal body's overflow can't clip it.
const { anchoredStyle } = useAnchoredList(fieldEl, open);

const optionId = (i: number) => `${listboxId}-opt-${i}`;

// Keep the highlighted option visible as the arrow keys move it past the list's own scroll.
watch(activeIndex, (i) => {
  if (!open.value || !import.meta.client) return;
  nextTick(() => document.getElementById(optionId(i))?.scrollIntoView({ block: 'nearest' }));
});
</script>

<template>
  <div class="flex flex-col gap-[0.3rem] text-[0.75rem] text-ink-muted">
    <span :id="`${listboxId}-label`">Tags</span>
    <div
      ref="fieldEl"
      class="flex flex-wrap items-center gap-[0.35rem] rounded-none border border-line bg-panel px-[0.5rem] py-[0.4rem] focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
      @click="inputEl?.focus()"
    >
      <!-- Selected tags as chips in their own colour (deliberately unlike the rank badge). -->
      <span
        v-for="tag in selected"
        :key="tag.id"
        class="inline-flex items-center gap-[0.3rem] rounded-[3px] border px-[0.4rem] py-[0.15rem] text-[0.75rem]"
        :style="tagChipStyle(tag.color)"
      >
        {{ tag.name }}
        <button
          type="button"
          class="cursor-pointer border-0 bg-transparent p-0 text-[0.85rem] leading-none text-current opacity-70 font-[inherit] hover:opacity-100"
          :aria-label="`Remove tag ${tag.name}`"
          @click.stop="removeTag(tag.id)"
        >
          ✕
        </button>
      </span>

      <!-- The combobox input. role/aria wire it to the listbox below for screen readers. -->
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="listboxId"
        :aria-activedescendant="open && options.length ? optionId(activeIndex) : undefined"
        :aria-labelledby="`${listboxId}-label`"
        :maxlength="TAG_NAME_MAX_LENGTH"
        :placeholder="selected.length ? '' : 'Add tags…'"
        class="min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-[0.85rem] text-ink-soft outline-none font-[inherit]"
        @focus="openList"
        @input="openList"
        @keydown="onKeydown"
        @blur="onBlur"
      />
    </div>

    <!-- Suggestion list. Teleported to <body> and fixed-positioned (via useAnchoredList) so it
         layers over the modal instead of growing it, and the modal body's overflow can't clip
         it. z-[55] sits above the modal (z-50) and below toasts (z-60). Its own scroll caps the
         height; the flip and width come from the anchored style. -->
    <Teleport to="body">
      <ul
        v-if="open && options.length"
        :id="listboxId"
        role="listbox"
        :style="anchoredStyle"
        class="z-[55] m-0 flex list-none flex-col gap-[1px] overflow-y-auto border border-line bg-[rgba(8,5,20,0.98)] p-[0.2rem] shadow-[0_0_24px_rgba(0,0,0,0.5)]"
        @mousedown.prevent
      >
      <li
        v-for="(option, i) in options"
        :id="optionId(i)"
        :key="option.kind === 'tag' ? option.tag.id : 'create'"
        role="option"
        :aria-selected="i === activeIndex"
        class="flex cursor-pointer items-center gap-[0.4rem] rounded-[2px] px-[0.5rem] py-[0.3rem] text-[0.82rem]"
        :class="i === activeIndex ? 'bg-accent/20 text-ink' : 'text-ink-muted hover:bg-accent/10'"
        @mousedown.prevent="choose(option)"
        @mouseenter="activeIndex = i"
      >
        <template v-if="option.kind === 'tag'">
          <span class="h-[0.6rem] w-[0.6rem] flex-none rounded-full" :style="tagSwatchStyle(option.tag.color)" />
          {{ option.tag.name }}
        </template>
        <template v-else>
          <span class="text-ink-dim">Create</span> "{{ option.label }}"
        </template>
      </li>
      </ul>
    </Teleport>
  </div>
</template>
