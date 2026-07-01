<script setup lang="ts">
import { storeToRefs } from 'pinia';
import {
  client,
  type Quest,
  type QuestWithWarnings,
  type CompleteResult,
  type CampaignDetail,
  type CampaignRow,
} from '~/lib/api-client';
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_COLOR } from '~/composables/campaignStatus';
import { useQuestsStore } from '~/stores/quests';

const quests = useQuestsStore();
const { campaigns } = storeToRefs(quests);

onMounted(() => { quests.load(); });

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

// ── List ↔ detail ───────────────────────────────────────────────────────────────
// null → list view; set → detail view. Detail is page-local view state; the campaign
// list itself lives in the shared store.
const selectedCampaign = ref<CampaignDetail | null>(null);
async function openCampaign(id: string) {
  const res = await client.api.campaigns[':id'].$get({ param: { id } });
  if (res.ok) selectedCampaign.value = await res.json();
}
function backToList() { selectedCampaign.value = null; }

// New-campaign form (inline, toggled in the list view).
const showNewForm = ref(false);
function onCampaignCreated(created: CampaignRow) {
  quests.addCampaign(created);
  showNewForm.value = false;
}

// Edited (title/description/rank/deadline) via CampaignForm in the detail view.
function onCampaignSaved(updated: CampaignRow) {
  if (selectedCampaign.value?.id === updated.id)
    selectedCampaign.value = { ...selectedCampaign.value, ...updated };
  quests.updateCampaignRow(updated);
}

async function completeCampaign() {
  if (!selectedCampaign.value) return;
  const id = selectedCampaign.value.id;
  const res = await client.api.campaigns[':id'].complete.$post({ param: { id } });
  if (!res.ok) return;
  const updated = await res.json();
  selectedCampaign.value = { ...selectedCampaign.value, status: updated.status, completedAt: updated.completedAt };
  quests.setCampaignStatus(id, { status: updated.status, completedAt: updated.completedAt });
}

async function startCampaign() {
  if (!selectedCampaign.value) return;
  const id = selectedCampaign.value.id;
  const res = await client.api.campaigns[':id'].start.$post({ param: { id } });
  if (!res.ok) return;
  const updated = await res.json();
  selectedCampaign.value = { ...selectedCampaign.value, status: updated.status };
  quests.setCampaignStatus(id, { status: updated.status });
}

// Drop a quest from the open campaign's detail list, if it's the one shown.
function removeFromCampaign(id: string) {
  if (!selectedCampaign.value) return;
  selectedCampaign.value = {
    ...selectedCampaign.value,
    quests: selectedCampaign.value.quests.filter((q) => q.id !== id),
  };
}
function mergeIntoCampaign(result: QuestWithWarnings) {
  if (!selectedCampaign.value?.quests.some((q) => q.id === result.quest.id)) return;
  selectedCampaign.value = {
    ...selectedCampaign.value,
    // Merge so nested subTasks (absent from the PATCH response) are preserved.
    quests: selectedCampaign.value.quests.map((q) =>
      q.id === result.quest.id ? { ...q, ...result.quest } : q,
    ),
  };
}

// CampaignView quest handlers. The store applies player/XP + campaign auto-transition;
// here we keep the open detail's quest list in sync (it's separate from the store).
function onCampaignQuestCompleted(result: CompleteResult) {
  quests.applyCompleted(result);
  removeFromCampaign(result.quest.id);
  // applyCompleted bumps the store's list to 'clearing'; mirror it on the open detail.
  if (selectedCampaign.value?.id === result.quest.campaignId && selectedCampaign.value.status === 'active')
    selectedCampaign.value = { ...selectedCampaign.value, status: 'clearing' };
}
function onCampaignQuestDeleted(id: string) {
  removeFromCampaign(id);
}
function onCampaignQuestUpdated(result: QuestWithWarnings) {
  quests.applyUpdated(result);
  mergeIntoCampaign(result);
}

// ── Quest detail modal (opened from inside a campaign) ───────────────────────────
const selectedQuest = ref<Quest | null>(null);
const questDetailOrigin = ref<{ x: number; y: number } | null>(null);
function openQuestDetail(quest: Quest, event?: MouseEvent) {
  const el = event?.currentTarget;
  if (el instanceof HTMLElement) {
    const r = el.getBoundingClientRect();
    questDetailOrigin.value = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  } else {
    questDetailOrigin.value = null;
  }
  selectedQuest.value = quest;
}
function onDetailCompleted(result: CompleteResult) {
  onCampaignQuestCompleted(result);
  selectedQuest.value = null;
}
function onDetailDeleted(id: string) {
  quests.removeQuest(id);
  removeFromCampaign(id);
  selectedQuest.value = null;
}
function onDetailUpdated(result: QuestWithWarnings) {
  onCampaignQuestUpdated(result);
  if (selectedQuest.value?.id === result.quest.id)
    selectedQuest.value = { ...selectedQuest.value, ...result.quest };
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex items-center justify-between gap-4">
      <h1 class="m-0 text-[1.1rem] font-bold uppercase tracking-[0.1em] text-ink-bright">Campaigns</h1>
      <button
        v-if="selectedCampaign"
        type="button"
        class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.4rem] text-[0.8rem] font-semibold text-ink font-[inherit] hover:border-accent"
        @click="backToList"
      >← Back</button>
      <button
        v-else
        type="button"
        class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.4rem] text-[0.8rem] font-semibold text-ink font-[inherit] hover:border-accent"
        @click="showNewForm = !showNewForm"
      >
        {{ showNewForm ? '✕ Cancel' : '+ New Campaign' }}
      </button>
    </header>

    <!-- List view -->
    <template v-if="!selectedCampaign">
      <CampaignForm v-if="showNewForm" mode="create" @created="onCampaignCreated" />

      <div class="flex flex-col gap-[0.7rem]">
        <p v-if="!campaigns.length" class="m-0 text-[0.85rem] text-line-soft">No campaigns yet. Start one above.</p>
        <button
          v-for="c in campaigns"
          :key="c.id"
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 border border-line bg-[rgba(14,9,30,0.6)] px-4 py-[0.85rem] text-left text-ink-soft hover:border-accent"
          @click="openCampaign(c.id)"
        >
          <span class="grid h-[1.9rem] w-[1.9rem] flex-none place-items-center border border-[#6a50c8] bg-panel font-extrabold text-[#c9bcff]">{{ c.difficulty }}</span>
          <span class="flex-auto text-[0.95rem]">{{ c.title }}</span>
          <span class="flex flex-none flex-col items-end gap-[0.2rem]">
            <span class="text-[0.68rem] font-bold uppercase tracking-[0.1em]" :style="{ color: CAMPAIGN_STATUS_COLOR[c.status] }">
              {{ CAMPAIGN_STATUS_LABEL[c.status] }}
            </span>
            <span class="text-[0.75rem] text-ink-muted">{{ c.questCount }} quest{{ c.questCount === 1 ? '' : 's' }}</span>
            <span v-if="c.deadline" class="text-[0.72rem] text-[#6a5da0]">⌛ {{ fmtDate(c.deadline) }}</span>
          </span>
        </button>
      </div>
    </template>

    <!-- Detail view -->
    <CampaignView
      v-else
      :campaign="selectedCampaign"
      @complete="completeCampaign"
      @start="startCampaign"
      @saved="onCampaignSaved"
      @quest-open="openQuestDetail"
      @quest-completed="onCampaignQuestCompleted"
      @quest-deleted="onCampaignQuestDeleted"
      @quest-updated="onCampaignQuestUpdated"
    />

    <!-- Quest detail modal. -->
    <HubPanel
      v-if="selectedQuest"
      title="Quest"
      :origin="questDetailOrigin"
      :max-width="980"
      @close="selectedQuest = null"
    >
      <QuestDetail
        :quest="selectedQuest"
        :campaign-name="quests.campaignName(selectedQuest.campaignId)"
        @completed="onDetailCompleted"
        @deleted="onDetailDeleted"
        @updated="onDetailUpdated"
      />
    </HubPanel>
  </div>
</template>
