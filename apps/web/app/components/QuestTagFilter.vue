<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useTagsStore } from '~/stores/tags';
import { useQuestFilters } from '~/composables/useQuestFilters';
import { useTagCombobox } from '~/composables/useTagCombobox';
import { tagChipStyle, tagSwatchStyle } from '~/lib/tag-colors';
import type { TagWithUsage } from '~/lib/api-client';

// Scalable tag filter: a button opening a searchable popover instead of a chip per tag inline
// (which stopped scaling past ~20 tags). Selected tags still show OUTSIDE the popover as
// coloured chips (capped, with "+N more") so the active filter is visible at a glance. Shares
// the keyboard/Escape model with the quest-form picker via useTagCombobox.
const MAX_VISIBLE_CHIPS = 4;

const tagsStore = useTagsStore();
const { sortedTags } = storeToRefs(tagsStore);
onMounted(() => { tagsStore.load(); });

const { selectedTagIds, isTagSelected, toggleTag, pruneUnknownTags } = useQuestFilters();

const knownIds = computed(() => new Set(sortedTags.value.map((t) => t.id)));

// Once the tags have actually loaded, strip any `?tags=` id that no longer exists (a deleted
// tag lingering in a bookmarked URL) so the list can't be filtered by an invisible tag.
watchEffect(() => {
  if (tagsStore.loaded) pruneUnknownTags(knownIds.value);
});

// Selected tags resolved to their rows (name + colour), in URL order, known ones only.
const byId = computed(() => new Map(sortedTags.value.map((t) => [t.id, t])));
const selectedTags = computed(() =>
  selectedTagIds.value.map((id) => byId.value.get(id)).filter((t): t is TagWithUsage => t != null),
);
const visibleChips = computed(() => selectedTags.value.slice(0, MAX_VISIBLE_CHIPS));
const overflowCount = computed(() => Math.max(0, selectedTags.value.length - MAX_VISIBLE_CHIPS));

// Popover search.
const query = ref('');
const normalizedQuery = computed(() => query.value.trim().toLowerCase());
const filtered = computed(() =>
  normalizedQuery.value === ''
    ? sortedTags.value
    : sortedTags.value.filter((t) => t.normalizedName.includes(normalizedQuery.value)),
);

const rootEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const listboxId = useId();

const { open, activeIndex, openList, close, onKeydown } = useTagCombobox<TagWithUsage>({
  query,
  options: filtered,
  // Toggle in place — the popover stays open for multi-select.
  select: (tag) => toggleTag(tag.id),
});

function toggleOpen() {
  if (open.value) {
    close();
  } else {
    openList();
    nextTick(() => inputEl.value?.focus());
  }
}

// Close on a click/tap outside the widget (the popover has no backdrop of its own).
function onDocPointerDown(event: PointerEvent) {
  if (open.value && rootEl.value && !rootEl.value.contains(event.target as Node)) close();
}
watch(open, (isOpen) => {
  if (!import.meta.client) return;
  if (isOpen) document.addEventListener('pointerdown', onDocPointerDown);
  else document.removeEventListener('pointerdown', onDocPointerDown);
});
onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('pointerdown', onDocPointerDown);
});

const optionId = (i: number) => `${listboxId}-opt-${i}`;
</script>

<template>
  <div ref="rootEl" class="relative flex flex-wrap items-center gap-1">
    <!-- Trigger: shows the selected count so the filter reads even with the popover closed. -->
    <button
      type="button"
      class="flex cursor-pointer items-center gap-1 rounded-none border px-[0.6rem] py-[0.3rem] text-[0.75rem] font-semibold font-[inherit] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
      :class="selectedTags.length ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink-dim hover:border-line-soft hover:text-ink'"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      Tags<span v-if="selectedTags.length"> · {{ selectedTags.length }}</span>
      <span aria-hidden="true" class="text-[0.6rem]">▾</span>
    </button>

    <!-- Active selection, visible outside the popover; capped so the bar can't swell. -->
    <span
      v-for="tag in visibleChips"
      :key="tag.id"
      class="inline-flex items-center gap-[0.3rem] rounded-[3px] border px-[0.4rem] py-[0.15rem] text-[0.72rem]"
      :style="tagChipStyle(tag.color)"
    >
      {{ tag.name }}
      <button
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 text-[0.8rem] leading-none text-current opacity-70 font-[inherit] hover:opacity-100"
        :aria-label="`Remove tag filter ${tag.name}`"
        @click="toggleTag(tag.id)"
      >
        ✕
      </button>
    </span>
    <span v-if="overflowCount" class="text-[0.72rem] text-ink-muted">+{{ overflowCount }} more</span>

    <!-- Popover -->
    <div
      v-if="open"
      class="absolute left-0 top-[calc(100%+0.35rem)] z-20 flex w-[15rem] flex-col gap-[0.4rem] border border-line bg-[rgba(8,5,20,0.98)] p-[0.5rem] shadow-[0_0_24px_rgba(0,0,0,0.5)]"
    >
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="listboxId"
        :aria-activedescendant="filtered.length ? optionId(activeIndex) : undefined"
        placeholder="Search tags…"
        class="w-full rounded-none border border-line bg-panel px-[0.5rem] py-[0.35rem] text-[0.82rem] text-ink-soft outline-none font-[inherit] focus:border-accent"
        @keydown="onKeydown"
      />

      <ul
        v-if="filtered.length"
        :id="listboxId"
        role="listbox"
        aria-multiselectable="true"
        class="m-0 flex max-h-[13rem] list-none flex-col gap-[1px] overflow-y-auto p-0"
      >
        <li
          v-for="(tag, i) in filtered"
          :id="optionId(i)"
          :key="tag.id"
          role="option"
          :aria-selected="isTagSelected(tag.id)"
          class="flex cursor-pointer items-center gap-[0.45rem] rounded-[2px] px-[0.45rem] py-[0.3rem] text-[0.82rem]"
          :class="i === activeIndex ? 'bg-accent/20 text-ink' : 'text-ink-muted hover:bg-accent/10'"
          @mousedown.prevent="toggleTag(tag.id)"
          @mouseenter="activeIndex = i"
        >
          <span class="h-[0.6rem] w-[0.6rem] flex-none rounded-full" :style="tagSwatchStyle(tag.color)" />
          <span class="min-w-0 flex-1 truncate">{{ tag.name }}</span>
          <span v-if="isTagSelected(tag.id)" aria-hidden="true" class="flex-none text-accent-light">✓</span>
        </li>
      </ul>
      <p v-else class="m-0 px-[0.45rem] py-[0.3rem] text-[0.78rem] text-ink-muted">No tags match.</p>
    </div>
  </div>
</template>
