<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type {
  RecurringQuest,
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

// New-ritual form modal.
const showNewForm = ref(false);
const newOrigin = ref<{ x: number; y: number } | null>(null);
function openNewForm(event?: MouseEvent) {
  const el = event?.currentTarget;
  if (el instanceof HTMLElement) {
    const r = el.getBoundingClientRect();
    newOrigin.value = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  } else {
    newOrigin.value = null;
  }
  showNewForm.value = true;
}
async function onCreated(_quest: RecurringQuest) {
  showNewForm.value = false;
  await quests.refreshRecurring();
}

function onCompleted(result: RecurringCompleteResult) {
  quests.applyRecurringCompleted(result);
}
function onDeleted(id: string) {
  quests.removeRecurring(id);
}
function onUpdated(quest: RecurringQuest) {
  quests.applyRecurringUpdated(quest);
}
function onAchievementsEarned(achievements: Achievement[]) {
  feedback.showAchievements(achievements);
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1 class="page-title">Rituals</h1>
      <button type="button" class="hdr-btn" @click="openNewForm">+ New Ritual</button>
    </header>

    <div class="quest-list">
      <p v-if="!recurringQuests.length" class="hint">
        No rituals yet. Create one above to start a streak.
      </p>
      <RecurringQuestCard
        v-for="rq in recurringQuests"
        :key="rq.id"
        :quest="rq"
        @completed="onCompleted"
        @deleted="onDeleted"
        @updated="onUpdated"
        @achievements-earned="onAchievementsEarned"
      />
    </div>

    <HubPanel
      v-if="showNewForm"
      title="New Ritual"
      :origin="newOrigin"
      @close="showNewForm = false"
    >
      <RecurringQuestForm mode="create" @created="onCreated" />
    </HubPanel>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.page-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #efeaff;
}
.hdr-btn {
  background: transparent;
  border: 1px solid #2a2050;
  color: #d0c8f8;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
}
.hdr-btn:hover { border-color: #7c5ce8; }
.quest-list { display: flex; flex-direction: column; gap: 0.7rem; }
.hint { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
</style>
