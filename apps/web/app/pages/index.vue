<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Quest, QuestWithWarnings, CompleteResult } from '~/lib/api-client';
import { useQuestsStore } from '~/stores/quests';
import { usePlayerStore } from '~/stores/player';
import { useEntityModals } from '~/composables/useEntityModals';
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts';
import { useQuestFilters } from '~/composables/useQuestFilters';
import { useReducedMotion } from '~/composables/useReducedMotion';
import { bucketByDeadline, formatDate, localDateString } from '~/lib/date';

const quests = useQuestsStore();
const player = usePlayerStore();
const { activeQuests } = storeToRefs(quests);

// Counts/lists come from the shared store; the layout already loaded them, but calling
// load() here too makes the page safe to hit directly (it self-guards re-fetches).
onMounted(() => { quests.load(); });

// Quick-add owns its own POST (rich capture: rank + deadline + tags) and hands the created
// quest back for the store to fold in — the same shape the New Quest modal emits.
function onQuickCreated(result: QuestWithWarnings) {
  quests.addQuest(result);
}

// ── Modals: create / detail / edit ──────────────────────────────────────────────
// Open state + animation origins live in the shared composable; the entity-specific
// glue (which store method each result applies) stays here.
const {
  showCreate,
  createOrigin,
  openCreate,
  closeCreate,
  selected: selectedQuest,
  detailOrigin,
  openDetail: openQuestDetail,
  closeDetail,
  editing: editingQuest,
  editOrigin,
  openEdit: openEditQuest,
  closeEdit,
} = useEntityModals<Quest>();

function onCreated(result: QuestWithWarnings) {
  quests.addQuest(result);
  closeCreate();
}
function onQuestEdited(result: QuestWithWarnings) {
  onUpdated(result);
  closeEdit();
}
// Immediate completion (reduced motion, sub-tasks, 409): apply everything and drop the row now.
function onCompleted(result: CompleteResult) {
  quests.applyCompleted(result);
}
// Animated path, "done" beat: the row is still on the list; apply only the server-authoritative
// player XP so the telemetry counter rolls and the bar grows while the row holds on "done".
function onGranted(result: CompleteResult) {
  player.applyProgress(result.player);
}
// Animated path, after the slide: NOW drop the quest from the store — this removes the (already
// off-screen) row and decrements TODAY. applyCompleted re-applies the same XP idempotently and
// fires the level-up toast. Then collapse the placeholder so the rows below glide up.
function onExitDone({ result, placeholder }: { result: CompleteResult; placeholder: HTMLElement | null }) {
  quests.applyCompleted(result);
  if (!placeholder) return;
  const container = placeholder.parentElement;
  const gap = container ? parseFloat(getComputedStyle(container).rowGap || '0') || 0 : 0;
  requestAnimationFrame(() => {
    placeholder.style.height = '0px';
    placeholder.style.marginTop = `-${gap}px`; // cancel one flex gap so the slot closes fully
  });
  setTimeout(() => placeholder.remove(), 400);
}
function onDeleted(id: string) {
  quests.removeQuest(id);
}
function onUpdated(result: QuestWithWarnings) {
  quests.applyUpdated(result);
  if (selectedQuest.value?.id === result.quest.id)
    selectedQuest.value = { ...selectedQuest.value, ...result.quest };
}
function onDetailCompleted(result: CompleteResult) {
  onCompleted(result);
  closeDetail();
}
function onDetailDeleted(id: string) {
  onDeleted(id);
  closeDetail();
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────────
// `q` opens the New Quest modal through the same path the "+ New Quest" button uses —
// no second open route. Suppressed while any of this page's three quest modals is open so
// it can't stack a second modal on top. (There is no global "any modal open" state yet;
// this guard is scoped to this page's modals — see the report.)
useKeyboardShortcuts([
  {
    key: 'q',
    description: 'New quest',
    handler: (event) => {
      if (showCreate.value || selectedQuest.value != null || editingQuest.value != null) return;
      event.preventDefault();
      openCreate();
    },
  },
]);

// ── Rank filter ─────────────────────────────────────────────────────────────────
// The state and its URL encoding live in useQuestFilters; the chips live in QuestFilterBar
// (which reads the same composable). The page keeps only what is genuinely its own: the
// list to narrow, and clearing from its own empty state.
const { filterQuests, clearFilter, hideSubTasks } = useQuestFilters();

// ── List mount stagger ──────────────────────────────────────────────────────────
// Each row appears ~20ms after the one above (capped so a long list doesn't trail forever),
// via the per-row `dl-row-in` mount animation. The delay rides in as a custom property the
// animation reads, and is zeroed under reduced motion — the list then appears at once rather
// than staggering instantly-visible rows over time.
const { reduced } = useReducedMotion();
function staggerStyle(index: number) {
  const delay = reduced.value ? 0 : Math.min(index, 12) * 20;
  return { '--dl-stagger-delay': `${delay}ms` };
}

// ── Grouping by deadline ────────────────────────────────────────────────────────
type QuestGroup = {
  key: string; // "overdue" | "YYYY-MM-DD" | "standing"
  label: string;
  isOverdue: boolean;
  quests: Quest[];
};

// Only top-level quests; sub-tasks render nested inside their parent's QuestCard.
// This is also the denominator of "Showing X of Y" — Y counts what the list would show
// unfiltered, not every row in the store.
const baseQuests = computed(() => (activeQuests.value ?? []).filter((q) => q.parentId == null));

const visibleQuests = computed(() => filterQuests(baseQuests.value));

const questGroups = computed<QuestGroup[]>(() => {
  // Grouping runs on the filtered list, so a group whose every quest was filtered out
  // never gets built — no bare "OVERDUE" heading with nothing under it.
  const { overdue, dated, standing } = bucketByDeadline(visibleQuests.value);
  const todayKey = localDateString();

  const groups: QuestGroup[] = [];

  if (overdue.length) {
    overdue.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    groups.push({ key: 'overdue', label: 'OVERDUE', isOverdue: true, quests: overdue });
  }

  for (const key of [...dated.keys()].sort()) {
    const bucket = dated.get(key)!;
    bucket.sort((a, b) => a.title.localeCompare(b.title));
    const [y, m, day] = key.split('-').map(Number);
    const d = new Date(y!, m! - 1, day!);
    const datePart = formatDate(d, { day: 'numeric', month: 'short' }).toUpperCase();
    const weekday = formatDate(d, { weekday: 'short' }).toUpperCase();
    // Today reads simply "TODAY"; other days read "FRI · 25 JUL" (weekday · date).
    const label = key === todayKey ? 'TODAY' : `${weekday} · ${datePart}`;
    groups.push({ key, label, isOverdue: false, quests: bucket });
  }

  if (standing.length) {
    standing.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    groups.push({ key: 'standing', label: 'STANDING ORDERS', isOverdue: false, quests: standing });
  }

  return groups;
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- A discreet way to the full New Quest form (description, parent, sub-tasks); the fast
         path is the inline quick-add below. Also reachable with the `q` shortcut. -->
    <div class="flex justify-end">
      <button
        type="button"
        class="dl-focus-inset flex cursor-pointer items-center gap-1.5 border border-dl-grid-line bg-dl-surface px-3 py-1.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted transition-colors hover:bg-dl-sunk hover:text-dl-ink"
        @click="openCreate"
      >
        + New quest
        <kbd class="border border-dl-hairline px-1 text-[0.6rem] normal-case text-dl-ink-faint">q</kbd>
      </button>
    </div>

    <!-- Hidden when there is nothing to filter, so an empty board stays an empty board
         rather than a set of controls over nothing. -->
    <QuestFilterBar
      v-if="baseQuests.length"
      :shown="visibleQuests.length"
      :total="baseQuests.length"
    />

    <QuestQuickAdd @created="onQuickCreated" />

    <div class="flex flex-col gap-5">
      <section v-for="group in questGroups" :key="group.key" class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2 border-b border-dl-band-line pb-1">
          <span
            class="font-dl-mono text-dl-label uppercase tracking-wide"
            :class="group.isOverdue ? 'text-dl-magenta' : 'text-dl-ink-muted'"
          >{{ group.label }}</span>
          <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ group.quests.length }}</span>
        </div>
        <!-- Plain container (NOT a TransitionGroup): the row EXIT is imperative (placeholder +
             absolute slide, owned by QuestRow → onExitDone here), and the ENTER stagger is a
             per-row mount animation (`dl-row-in` + the `--dl-stagger-delay` set below).
             `relative` anchors the absolute exiting row; `overflow-x: clip` swallows its 110%
             slide-out so no ancestor grows a horizontal scrollbar (clip, unlike hidden, does not
             make this a scroll container on the y-axis). -->
        <div class="relative flex flex-col gap-1 [overflow-x:clip]">
          <QuestRow
            v-for="(q, i) in group.quests"
            :key="q.id"
            :quest="q"
            :style="staggerStyle(i)"
            selectable
            :show-sub-tasks="!hideSubTasks"
            @open="openQuestDetail"
            @granted="onGranted"
            @completed="onCompleted"
            @exit-done="onExitDone"
            @deleted="onDeleted"
          />
        </div>
      </section>

      <!-- First run: no quests at all. -->
      <div
        v-if="!baseQuests.length"
        class="corner-cut mx-auto flex max-w-md flex-col items-center gap-3 border border-dl-grid-line bg-dl-surface px-6 py-12 text-center"
      >
        <span class="corner-cut-sm grid h-12 w-12 place-items-center bg-dl-violet-wash text-dl-violet" aria-hidden="true">◆</span>
        <h2 class="m-0 font-dl-display text-dl-title font-semibold uppercase tracking-wide text-dl-ink">No quests yet</h2>
        <p class="m-0 text-dl-body text-dl-ink-muted">Your log is empty. Add your first quest to start earning XP and ranking up.</p>
        <button
          type="button"
          class="dl-focus-inset mt-1 cursor-pointer bg-dl-violet px-4 py-2 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110"
          @click="openCreate"
        >
          Add first quest
        </button>
      </div>

      <!-- Quests exist, but every one is filtered out — say so and offer the way out. -->
      <div
        v-else-if="!questGroups.length"
        class="corner-cut mx-auto flex max-w-md flex-col items-center gap-3 border border-dl-grid-line bg-dl-surface px-6 py-12 text-center"
      >
        <span class="corner-cut-sm grid h-12 w-12 place-items-center bg-dl-sunk text-dl-ink-faint" aria-hidden="true">+</span>
        <h2 class="m-0 font-dl-display text-dl-title font-semibold uppercase tracking-wide text-dl-ink">No quests match</h2>
        <p class="m-0 text-dl-body text-dl-ink-muted">Nothing in the current filters. Loosen a filter to see more.</p>
        <button
          type="button"
          class="dl-focus-inset mt-1 cursor-pointer border border-dl-violet bg-dl-violet-wash px-4 py-2 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-dl-violet transition-colors hover:bg-dl-violet hover:text-white"
          @click="clearFilter"
        >
          Clear filters
        </button>
      </div>
    </div>

    <!-- New-quest form modal. -->
    <DlModal
      v-if="showCreate"
      title="New quest"
      :origin="createOrigin"
      @close="closeCreate"
    >
      <QuestForm mode="create" @created="onCreated" />
    </DlModal>

    <!-- Single-quest detail. -->
    <DlModal
      v-if="selectedQuest"
      title="Quest"
      :origin="detailOrigin"
      :max-width="720"
      @close="closeDetail"
    >
      <QuestDetail
        :quest="selectedQuest"
        @completed="onDetailCompleted"
        @deleted="onDetailDeleted"
        @edit="openEditQuest"
      />
    </DlModal>

    <!-- Edit-quest modal — stacks above the detail modal when it's open. -->
    <DlModal
      v-if="editingQuest"
      title="Edit quest"
      :origin="editOrigin"
      @close="closeEdit"
    >
      <QuestForm
        mode="edit"
        :initial="editingQuest"
        @updated="onQuestEdited"
        @cancel="closeEdit"
      />
    </DlModal>
  </div>
</template>
