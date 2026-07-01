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

// NOTE: "Rituals" is purely the UI name for recurring quests. The API, DB tables and
// shared types keep the `recurring` vocabulary untouched — this is presentation only.
const quests = useQuestsStore();
const feedback = useFeedbackStore();
const { recurringQuests } = storeToRefs(quests);

onMounted(() => { quests.load(); });

// Viewport point a modal grows out of — the centre of the element that opened it.
function originFrom(event?: MouseEvent): { x: number; y: number } | null {
  const el = event?.currentTarget;
  if (el instanceof HTMLElement) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return null;
}

// New-ritual form modal.
const showNewForm = ref(false);
const newOrigin = ref<{ x: number; y: number } | null>(null);
function openNewForm(event?: MouseEvent) {
  newOrigin.value = originFrom(event);
  showNewForm.value = true;
}
async function onCreated(_quest: RecurringQuest) {
  showNewForm.value = false;
  await quests.refreshRecurring();
}

// Ritual detail modal (opened by clicking the ritual name).
const selectedRitual = ref<RecurringQuestWithStreak | null>(null);
const detailOrigin = ref<{ x: number; y: number } | null>(null);
function openDetail(quest: RecurringQuestWithStreak, event?: MouseEvent) {
  detailOrigin.value = originFrom(event);
  selectedRitual.value = quest;
}

// Edit-ritual modal (opened by the Edit button on a card or in the detail).
const editingRitual = ref<RecurringQuest | null>(null);
const editOrigin = ref<{ x: number; y: number } | null>(null);
function openEditRitual(quest: RecurringQuest, event?: MouseEvent) {
  editOrigin.value = originFrom(event);
  editingRitual.value = quest;
}

function onCompleted(result: RecurringCompleteResult) {
  quests.applyRecurringCompleted(result);
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
  selectedRitual.value = null;
}
function onDetailDeleted(id: string) {
  onDeleted(id);
  selectedRitual.value = null;
}
function onRitualEdited(quest: RecurringQuest) {
  onUpdated(quest);
  editingRitual.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex items-center justify-between gap-4">
      <h1 class="m-0 text-[1.1rem] font-bold uppercase tracking-[0.1em] text-ink-bright">Rituals</h1>
      <button type="button" class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.4rem] font-[inherit] text-[0.8rem] font-semibold text-ink hover:border-accent" @click="openNewForm">+ New Ritual</button>
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
      v-if="showNewForm"
      title="New Ritual"
      :origin="newOrigin"
      @close="showNewForm = false"
    >
      <RecurringQuestForm mode="create" @created="onCreated" />
    </HubPanel>

    <!-- Single-ritual detail — wide two-pane modal. -->
    <HubPanel
      v-if="selectedRitual"
      title="Ritual"
      :origin="detailOrigin"
      :max-width="980"
      @close="selectedRitual = null"
    >
      <RecurringQuestDetail
        :quest="selectedRitual"
        @completed="onDetailCompleted"
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
      @close="editingRitual = null"
    >
      <RecurringQuestForm
        mode="edit"
        :initial="editingRitual"
        @updated="onRitualEdited"
        @cancel="editingRitual = null"
      />
    </HubPanel>
  </div>
</template>
