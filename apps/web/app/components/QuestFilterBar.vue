<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { PRIORITY_STYLES, PRIORITY_DL_CLASS } from '~/lib/priority';
import { tagSwatchStyle } from '~/lib/tag-colors';
import { useQuestFilters } from '~/composables/useQuestFilters';
import { useTagsStore } from '~/stores/tags';
import type { QuestPriority } from '@soloquest/shared';

// The quest-list filter bar (Daylight). Desktop lays every dimension inline; mobile keeps the
// rank selector visible and folds the rest (tags · priority · hide sub-tasks) behind a
// counted "Filters" button that opens a bottom sheet. All state still lives in the URL via
// useQuestFilters — this only renders it. The two counts come in as props (only the page can
// count its own list).
const props = defineProps<{ shown: number; total: number }>();

const {
  selectedRanks,
  toggleRank,
  selectedPriorities,
  isPrioritySelected,
  togglePriority,
  selectedTagIds,
  isTagSelected,
  toggleTag,
  isCountFiltered,
  isFiltered,
  hideSubTasks,
  toggleSubTasks,
  clearFilter,
} = useQuestFilters();

// The filter offers the two SIGNALLED priorities only (high/low) — the same pair the row marks;
// "normal" is the unmarked default and isn't a chip (the URL still accepts it).
const FILTER_PRIORITIES: QuestPriority[] = ['high', 'low'];

const summaryParts = computed(() => {
  const parts: string[] = [];
  if (isCountFiltered.value) parts.push(`Showing ${props.shown} of ${props.total}`);
  else parts.push(`${props.total} ${props.total === 1 ? 'quest' : 'quests'}`);
  if (hideSubTasks.value) parts.push('Sub-tasks hidden');
  return parts;
});

// ── Mobile bottom sheet ─────────────────────────────────────────────────────────────────────
const sheetOpen = ref(false);
// Everything folded into the sheet (rank stays outside), so the button can show a count.
const sheetCount = computed(
  () => selectedPriorities.value.length + selectedTagIds.value.length + (hideSubTasks.value ? 1 : 0),
);

const tagsStore = useTagsStore();
const { sortedTags } = storeToRefs(tagsStore);
onMounted(() => { tagsStore.load(); });

const tagQuery = ref('');
const filteredTags = computed(() => {
  const q = tagQuery.value.trim().toLowerCase();
  return q ? sortedTags.value.filter((t) => t.normalizedName.includes(q)) : sortedTags.value;
});

function openSheet() {
  sheetOpen.value = true;
}
function closeSheet() {
  sheetOpen.value = false;
}
function onSheetKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeSheet();
}
watch(sheetOpen, (isOpen) => {
  if (!import.meta.client) return;
  if (isOpen) document.addEventListener('keydown', onSheetKeydown);
  else document.removeEventListener('keydown', onSheetKeydown);
});
onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('keydown', onSheetKeydown);
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- ── Desktop bar ──────────────────────────────────────────────────────────────────── -->
    <div class="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex">
      <div class="flex items-center gap-2">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Rank</span>
        <RankSelector :selected="selectedRanks" label="Filter by rank" @toggle="toggleRank" />
      </div>

      <QuestTagFilter />

      <div class="flex items-center gap-2">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Priority</span>
        <div class="flex gap-1" role="group" aria-label="Filter by priority">
          <button
            v-for="p in FILTER_PRIORITIES"
            :key="p"
            type="button"
            :aria-pressed="isPrioritySelected(p)"
            :aria-label="PRIORITY_STYLES[p].label"
            class="dl-focus-inset grid h-8 w-8 cursor-pointer place-items-center border text-dl-meta leading-none transition-colors"
            :class="
              isPrioritySelected(p)
                ? 'border-dl-violet bg-dl-violet text-white'
                : 'border-dl-grid-line bg-dl-surface hover:bg-dl-sunk'
            "
            @click="togglePriority(p)"
          >
            <span :class="isPrioritySelected(p) ? 'text-white' : PRIORITY_DL_CLASS[p]" aria-hidden="true">{{ PRIORITY_STYLES[p].glyph }}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        :aria-pressed="hideSubTasks"
        class="dl-focus-inset min-h-[2rem] cursor-pointer border px-3 py-1 font-dl-mono text-dl-label uppercase tracking-wide transition-colors"
        :class="
          hideSubTasks
            ? 'border-dl-violet bg-dl-violet-wash text-dl-violet'
            : 'border-dl-grid-line bg-dl-surface text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink'
        "
        @click="toggleSubTasks"
      >
        Hide sub-tasks
      </button>

      <p class="m-0 ml-auto flex items-center gap-2 font-dl-mono text-dl-label text-dl-ink-muted">
        <span>{{ summaryParts.join(' · ') }}</span>
        <template v-if="isFiltered">
          <span aria-hidden="true">·</span>
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-dl-violet hover:underline"
            @click="clearFilter"
          >
            Clear
          </button>
        </template>
      </p>
    </div>

    <!-- ── Mobile bar ───────────────────────────────────────────────────────────────────── -->
    <div class="flex flex-col gap-2 md:hidden">
      <div class="flex items-center gap-2">
        <RankSelector :selected="selectedRanks" label="Filter by rank" @toggle="toggleRank" />
        <button
          type="button"
          class="dl-focus-inset ml-auto flex min-h-dl-touch items-center gap-1.5 border border-dl-grid-line bg-dl-surface px-3 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted"
          @click="openSheet"
        >
          Filters
          <span
            v-if="sheetCount"
            class="grid h-4 min-w-4 place-items-center bg-dl-violet px-1 text-[0.6rem] font-semibold text-white"
          >{{ sheetCount }}</span>
        </button>
      </div>
      <p class="m-0 flex items-center gap-2 font-dl-mono text-dl-label text-dl-ink-muted">
        <span>{{ summaryParts.join(' · ') }}</span>
        <template v-if="isFiltered">
          <span aria-hidden="true">·</span>
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-dl-violet hover:underline"
            @click="clearFilter"
          >
            Clear
          </button>
        </template>
      </p>
    </div>

    <!-- ── Bottom sheet (mobile) ────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="sheetOpen" class="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Filters">
        <div class="absolute inset-0 bg-dl-ink/40" @click="closeSheet" />
        <div
          class="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col gap-4 border-t border-dl-band-line bg-dl-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div class="flex items-center justify-between">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Filters</span>
            <button
              type="button"
              class="dl-focus-inset cursor-pointer border-0 bg-transparent p-1 text-dl-ink-muted hover:text-dl-ink"
              aria-label="Close filters"
              @click="closeSheet"
            >
              ✕
            </button>
          </div>

          <!-- Priority -->
          <div class="flex flex-col gap-2">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Priority</span>
            <div class="flex gap-2" role="group" aria-label="Filter by priority">
              <button
                v-for="p in FILTER_PRIORITIES"
                :key="p"
                type="button"
                :aria-pressed="isPrioritySelected(p)"
                class="dl-focus-inset flex min-h-dl-touch flex-1 items-center justify-center gap-2 border font-dl-mono text-dl-label uppercase tracking-wide transition-colors"
                :class="
                  isPrioritySelected(p)
                    ? 'border-dl-violet bg-dl-violet text-white'
                    : 'border-dl-grid-line bg-dl-surface text-dl-ink-muted'
                "
                @click="togglePriority(p)"
              >
                <span :class="isPrioritySelected(p) ? 'text-white' : PRIORITY_DL_CLASS[p]" aria-hidden="true">{{ PRIORITY_STYLES[p].glyph }}</span>
                {{ PRIORITY_STYLES[p].short }}
              </button>
            </div>
          </div>

          <!-- Hide sub-tasks -->
          <button
            type="button"
            :aria-pressed="hideSubTasks"
            class="dl-focus-inset flex min-h-dl-touch items-center justify-between border px-3 font-dl-mono text-dl-label uppercase tracking-wide transition-colors"
            :class="
              hideSubTasks
                ? 'border-dl-violet bg-dl-violet-wash text-dl-violet'
                : 'border-dl-grid-line bg-dl-surface text-dl-ink-muted'
            "
            @click="toggleSubTasks"
          >
            Hide sub-tasks
            <span aria-hidden="true">{{ hideSubTasks ? '✓' : '' }}</span>
          </button>

          <!-- Tags -->
          <div class="flex min-h-0 flex-col gap-2">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Tags</span>
            <input
              v-model="tagQuery"
              type="text"
              placeholder="Search tags…"
              class="dl-focus-inset min-h-dl-touch border border-dl-grid-line bg-dl-surface px-3 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint"
            />
            <ul class="m-0 flex max-h-[30dvh] list-none flex-col gap-1 overflow-y-auto p-0">
              <li v-for="tag in filteredTags" :key="tag.id">
                <button
                  type="button"
                  :aria-pressed="isTagSelected(tag.id)"
                  class="dl-focus-inset flex min-h-dl-touch w-full items-center gap-2 border px-3 text-left text-dl-body transition-colors"
                  :class="
                    isTagSelected(tag.id)
                      ? 'border-dl-violet bg-dl-violet-wash text-dl-ink'
                      : 'border-dl-hairline bg-dl-surface text-dl-ink-muted'
                  "
                  @click="toggleTag(tag.id)"
                >
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="tagSwatchStyle(tag.color)" />
                  <span class="min-w-0 flex-1 truncate">{{ tag.name }}</span>
                  <span v-if="isTagSelected(tag.id)" aria-hidden="true" class="shrink-0 text-dl-violet">✓</span>
                </button>
              </li>
              <li v-if="!filteredTags.length" class="px-3 py-2 text-dl-meta text-dl-ink-faint">No tags match.</li>
            </ul>
          </div>

          <div class="flex gap-2">
            <button
              v-if="isFiltered"
              type="button"
              class="dl-focus-inset min-h-dl-touch flex-1 border border-dl-grid-line bg-dl-surface font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted"
              @click="clearFilter"
            >
              Clear all
            </button>
            <button
              type="button"
              class="dl-focus-inset min-h-dl-touch flex-1 bg-dl-violet font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white"
              @click="closeSheet"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
