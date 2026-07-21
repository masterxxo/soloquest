<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type {
  RecurringQuest,
  RecurringQuestWithStreak,
  RecurringCompleteResult,
  Achievement,
} from '~/lib/api-client';
import { useQuestsStore } from '~/stores/quests';
import { useFeedbackStore } from '~/stores/feedback';
import { useEntityModals } from '~/composables/useEntityModals';

// NOTE: "Rituals" is purely the UI name for recurring quests. The API, DB tables and
// shared types keep the `recurring` vocabulary untouched — this is presentation only.
const quests = useQuestsStore();
const feedback = useFeedbackStore();
const { recurringQuests } = storeToRefs(quests);

onMounted(() => { quests.load(); });

// ── Modals: create / detail / edit ──────────────────────────────────────────────
// The detail carries streak fields (RecurringQuestWithStreak); the edit form takes a
// bare row (RecurringQuest) — hence the two type params.
const {
  showCreate,
  createOrigin,
  openCreate,
  closeCreate,
  selected: selectedRitual,
  detailOrigin,
  openDetail,
  closeDetail,
  editing: editingRitual,
  editOrigin,
  openEdit: openEditRitual,
  closeEdit,
} = useEntityModals<RecurringQuestWithStreak, RecurringQuest>();

async function onCreated(_quest: RecurringQuest) {
  closeCreate();
  await quests.refreshRecurring();
}
function onCompleted(result: RecurringCompleteResult) {
  quests.applyRecurringCompleted(result);
}
// Backfilled a past day from the detail's heatmap. Fold the refreshed counters into the
// store and, because the detail stays open, into the selected ritual it renders from.
function onBackfilled(result: RecurringCompleteResult) {
  quests.applyRecurringBackfilled(result);
  if (
    selectedRitual.value?.id === result.completion.recurringQuestId &&
    selectedRitual.value.streak
  ) {
    selectedRitual.value = {
      ...selectedRitual.value,
      streak: { ...selectedRitual.value.streak, ...result.streak },
    };
  }
}
function onDeleted(id: string) {
  quests.removeRecurring(id);
}
function onUpdated(quest: RecurringQuest) {
  quests.applyRecurringUpdated(quest);
  // Keep an open detail in sync (merge over the streak fields it already holds).
  if (selectedRitual.value?.id === quest.id)
    selectedRitual.value = { ...selectedRitual.value, ...quest };
}
function onAchievementsEarned(achievements: Achievement[]) {
  feedback.showAchievements(achievements);
}

// From the detail modal: apply, then close it.
function onDetailCompleted(result: RecurringCompleteResult) {
  onCompleted(result);
  closeDetail();
}
function onDetailDeleted(id: string) {
  onDeleted(id);
  closeDetail();
}
function onRitualEdited(quest: RecurringQuest) {
  onUpdated(quest);
  closeEdit();
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex items-center justify-between gap-4">
      <h1 class="m-0 text-[1.1rem] font-bold uppercase tracking-[0.1em] text-ink-bright">Rituals</h1>
      <button type="button" class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.4rem] font-[inherit] text-[0.8rem] font-semibold text-ink hover:border-accent" @click="openCreate">+ New Ritual</button>
    </header>

    <div class="flex flex-col gap-[0.7rem]">
      <p v-if="!recurringQuests.length" class="m-0 text-[0.85rem] text-line-soft">
        No rituals yet. Create one above to start a streak.
      </p>
      <RecurringQuestCard
        v-for="rq in recurringQuests"
        :key="rq.id"
        :quest="rq"
        @open="openDetail"
        @edit="openEditRitual"
        @completed="onCompleted"
        @deleted="onDeleted"
        @achievements-earned="onAchievementsEarned"
      />
    </div>

    <!-- New-ritual form modal. -->
    <HubPanel
      v-if="showCreate"
      title="New Ritual"
      :origin="createOrigin"
      @close="closeCreate"
    >
      <RecurringQuestForm mode="create" @created="onCreated" />
    </HubPanel>

    <!-- Single-ritual detail — wide two-pane modal. -->
    <HubPanel
      v-if="selectedRitual"
      title="Ritual"
      :origin="detailOrigin"
      :max-width="980"
      @close="closeDetail"
    >
      <RecurringQuestDetail
        :quest="selectedRitual"
        @completed="onDetailCompleted"
        @backfilled="onBackfilled"
        @deleted="onDetailDeleted"
        @edit="openEditRitual"
        @achievements-earned="onAchievementsEarned"
      />
    </HubPanel>

    <!-- Edit-ritual modal — stacks above the detail modal when it's open. -->
    <HubPanel
      v-if="editingRitual"
      title="Edit Ritual"
      :origin="editOrigin"
      @close="closeEdit"
    >
      <RecurringQuestForm
        mode="edit"
        :initial="editingRitual"
        @updated="onRitualEdited"
        @cancel="closeEdit"
      />
    </HubPanel>
  </div>
</template>
