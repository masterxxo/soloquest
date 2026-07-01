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
