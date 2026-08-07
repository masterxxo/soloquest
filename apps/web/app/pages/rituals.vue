<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type {
  RecurringQuest,
  RecurringQuestWithStreak,
  RecurringCompleteResult,
  Achievement,
} from '~/lib/api-client';
import { RECURRING_XP_REWARD } from '@soloquest/shared';
import { useQuestsStore } from '~/stores/quests';
import { useFeedbackStore } from '~/stores/feedback';
import { useEntityModals } from '~/composables/useEntityModals';

// NOTE: "Rituals" is purely the UI name for recurring quests. The API, DB tables and shared
// types keep the `recurring` vocabulary untouched — this is presentation only.
const quests = useQuestsStore();
const feedback = useFeedbackStore();
const { recurringQuests, isInitialLoading } = storeToRefs(quests);

onMounted(() => { quests.load(); });

// Grouped by today's obligation — due (and pending), done today, and not due.
const groups = computed(() => {
  const due: RecurringQuestWithStreak[] = [];
  const done: RecurringQuestWithStreak[] = [];
  const notDue: RecurringQuestWithStreak[] = [];
  for (const q of recurringQuests.value) {
    if (q.isCompletedToday) done.push(q);
    else if (q.isDueToday) due.push(q);
    else notDue.push(q);
  }
  return [
    { key: 'due', label: 'Due today', items: due },
    { key: 'done', label: 'Done today', items: done },
    { key: 'not-due', label: 'Not due today', items: notDue },
  ].filter((g) => g.items.length);
});

const {
  showCreate, createOrigin, openCreate, closeCreate,
  selected: selectedRitual, detailOrigin, openDetail, closeDetail,
  editing: editingRitual, editOrigin, openEdit: openEditRitual, closeEdit,
} = useEntityModals<RecurringQuestWithStreak, RecurringQuest>();

async function onCreated(_quest: RecurringQuest) {
  closeCreate();
  await quests.refreshRecurring();
}
function onCompleted(result: RecurringCompleteResult) {
  quests.applyRecurringCompleted(result);
}
function onBackfilled(result: RecurringCompleteResult) {
  quests.applyRecurringBackfilled(result);
  if (selectedRitual.value?.id === result.completion.recurringQuestId && selectedRitual.value.streak) {
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
  if (selectedRitual.value?.id === quest.id) selectedRitual.value = { ...selectedRitual.value, ...quest };
}
function onAchievementsEarned(achievements: Achievement[]) {
  feedback.showAchievements(achievements);
}
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
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">{{ recurringQuests.length }} {{ recurringQuests.length === 1 ? 'ritual' : 'rituals' }}</span>
      <button
        type="button"
        class="dl-focus-inset cursor-pointer bg-dl-violet px-4 py-2 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110"
        @click="openCreate"
      >+ New ritual</button>
    </div>

    <div
      v-if="isInitialLoading"
      class="corner-cut mx-auto flex max-w-md flex-col items-center gap-3 border border-dl-grid-line bg-dl-surface px-6 py-12 text-center"
      role="status"
    >
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Loading rituals…</span>
    </div>

    <template v-else-if="recurringQuests.length">
      <section v-for="group in groups" :key="group.key" class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2 border-b border-dl-band-line pb-1">
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">{{ group.label }}</span>
          <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ group.items.length }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <RecurringQuestCard
            v-for="rq in group.items"
            :key="rq.id"
            :quest="rq"
            @open="openDetail"
            @completed="onCompleted"
            @deleted="onDeleted"
            @achievements-earned="onAchievementsEarned"
          />
        </div>
      </section>
    </template>

    <!-- Empty state: the same seven cells the screen is built from, in NOT SCHEDULED form. -->
    <div v-else class="corner-cut mx-auto flex max-w-md flex-col items-center gap-3 border border-dl-grid-line bg-dl-surface px-6 py-12 text-center">
      <span class="flex gap-1.5" aria-hidden="true">
        <HeatCell v-for="i in 7" :key="i" state="not_scheduled" :size="16" />
      </span>
      <h2 class="m-0 font-dl-display text-dl-title font-semibold uppercase tracking-wide text-dl-ink">No rituals yet</h2>
      <p class="m-0 text-dl-body text-dl-ink-muted">A ritual is a quest that comes back. Each completion is worth {{ RECURRING_XP_REWARD }} XP, and the streak is the number that grows — starting at zero.</p>
      <button
        type="button"
        class="dl-focus-inset mt-1 cursor-pointer bg-dl-violet px-4 py-2 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110"
        @click="openCreate"
      >Create your first ritual</button>
    </div>

    <DlModal v-if="showCreate" title="New ritual" :origin="createOrigin" @close="closeCreate">
      <RecurringQuestForm mode="create" @created="onCreated" />
    </DlModal>

    <DlModal v-if="selectedRitual" title="Ritual" :origin="detailOrigin" :max-width="640" @close="closeDetail">
      <RecurringQuestDetail
        :quest="selectedRitual"
        @completed="onDetailCompleted"
        @backfilled="onBackfilled"
        @deleted="onDetailDeleted"
        @edit="openEditRitual"
        @achievements-earned="onAchievementsEarned"
      />
    </DlModal>

    <DlModal v-if="editingRitual" title="Edit ritual" :origin="editOrigin" @close="closeEdit">
      <RecurringQuestForm mode="edit" :initial="editingRitual" @updated="onRitualEdited" @cancel="closeEdit" />
    </DlModal>
  </div>
</template>
