<script setup lang="ts">
import { storeToRefs } from 'pinia';
import {
  client,
  type Quest,
  type QuestWithWarnings,
  type CompleteResult,
} from '~/lib/api-client';
import { readApiError } from '~/lib/api-error';
import { useQuestsStore } from '~/stores/quests';
import { useFeedbackStore } from '~/stores/feedback';
import { useEntityModals } from '~/composables/useEntityModals';
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts';
import { bucketByDeadline, formatDate, localDateString } from '~/lib/date';

const quests = useQuestsStore();
const feedback = useFeedbackStore();
const { activeQuests } = storeToRefs(quests);

// Counts/lists come from the shared store; the layout already loaded them, but calling
// load() here too makes the page safe to hit directly (it self-guards re-fetches).
onMounted(() => { quests.load(); });

// ── Quick-add ─────────────────────────────────────────────────────────────────
// A title-only capture: posts an E-rank quest (description mirrors the title) so it
// lands in STANDING ORDERS immediately. The full form is one click away for details.
// `quickAdding` is a plain local ref (not the store's per-id completion guard): there is
// exactly one quick-add input, and the quest it creates has no id to key a guard on yet.
const quickTitle = ref('');
const quickAdding = ref(false);
async function quickAdd() {
  const title = quickTitle.value.trim();
  if (!title || quickAdding.value) return;
  quickAdding.value = true;
  try {
    const res = await client.api.quests.$post({
      json: { title, description: title, difficulty: 'E', deadline: null },
    });
    if (!res.ok) {
      // Say what went wrong and keep the typed title — the quest doesn't exist, so
      // clearing the input would throw the player's text away for nothing.
      const { message } = await readApiError(res, 'Could not create quest.');
      feedback.showNotice([message], 'warning');
      return;
    }
    quests.addQuest(await res.json());
    quickTitle.value = '';
  } finally {
    quickAdding.value = false;
  }
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
function onCompleted(result: CompleteResult) {
  quests.applyCompleted(result);
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

// ── Grouping by deadline ────────────────────────────────────────────────────────
type QuestGroup = {
  key: string; // "overdue" | "YYYY-MM-DD" | "standing"
  label: string;
  isOverdue: boolean;
  quests: Quest[];
};

const questGroups = computed<QuestGroup[]>(() => {
  // Only top-level quests; sub-tasks render nested inside their parent's QuestCard.
  const list = (activeQuests.value ?? []).filter((q) => q.parentId == null);
  const { overdue, dated, standing } = bucketByDeadline(list);
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
    const weekday = formatDate(d, { weekday: 'long' }).toUpperCase();
    const label =
      key === todayKey ? `TODAY · ${datePart} · ${weekday}` : `${datePart} · ${weekday}`;
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
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="m-0 text-[1.1rem] font-bold uppercase tracking-[0.1em] text-ink-bright">Quests</h1>
      <form class="flex items-center gap-2" @submit.prevent="quickAdd">
        <input
          v-model="quickTitle"
          type="text"
          class="min-w-[200px] border border-line bg-[rgba(14,9,30,0.7)] px-[0.7rem] py-[0.4rem] text-[0.85rem] text-ink-soft font-[inherit] focus:border-accent focus:outline-none"
          placeholder="Quick add a quest…"
          maxlength="255"
        />
        <button
          type="submit"
          class="cursor-pointer border border-accent bg-accent/12 px-[0.7rem] py-[0.4rem] text-[0.8rem] font-semibold text-ink font-[inherit] enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="quickAdding || !quickTitle.trim()"
        >
          Add
        </button>
        <button
          type="button"
          class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.4rem] text-[0.8rem] font-semibold text-ink font-[inherit] hover:border-accent"
          @click="openCreate"
        >+ New Quest <span class="ml-1 text-[0.7rem] font-normal text-ink-dim">(q)</span></button>
      </form>
    </header>

    <div class="flex flex-col gap-5">
      <section v-for="group in questGroups" :key="group.key" class="flex flex-col gap-2">
        <div
          class="border-b pb-[0.4rem] text-[0.7rem] uppercase tracking-[0.18em]"
          :class="group.isOverdue ? 'border-[rgba(192,84,58,0.3)] text-[#c0543a]' : 'border-line-soft/30 text-line-soft'"
        >
          {{ group.label }}
        </div>
        <div class="flex flex-col gap-2">
          <QuestCard
            v-for="q in group.quests"
            :key="q.id"
            :quest="q"
            selectable
            @open="openQuestDetail"
            @edit="openEditQuest"
            @completed="onCompleted"
            @deleted="onDeleted"
          />
        </div>
      </section>
      <p v-if="!questGroups.length" class="m-0 text-[0.85rem] text-line-soft">No active quests. Add your first above.</p>
    </div>

    <!-- New-quest form modal. -->
    <HubPanel
      v-if="showCreate"
      title="New Quest"
      :origin="createOrigin"
      @close="closeCreate"
    >
      <QuestForm mode="create" @created="onCreated" />
    </HubPanel>

    <!-- Single-quest detail — wide two-pane modal. -->
    <HubPanel
      v-if="selectedQuest"
      title="Quest"
      :origin="detailOrigin"
      :max-width="980"
      @close="closeDetail"
    >
      <QuestDetail
        :quest="selectedQuest"
        @completed="onDetailCompleted"
        @deleted="onDetailDeleted"
        @edit="openEditQuest"
      />
    </HubPanel>

    <!-- Edit-quest modal — stacks above the detail modal when it's open. -->
    <HubPanel
      v-if="editingQuest"
      title="Edit Quest"
      :origin="editOrigin"
      @close="closeEdit"
    >
      <QuestForm
        mode="edit"
        :initial="editingQuest"
        @updated="onQuestEdited"
        @cancel="closeEdit"
      />
    </HubPanel>
  </div>
</template>
