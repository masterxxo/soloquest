<script setup lang="ts">
import {
  type CampaignDetail,
  type CampaignRow,
  type CompleteResult,
  type Quest,
} from '~/lib/api-client';
import { RANK_COLORS } from '~/composables/useQuestActions';
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_COLOR } from '~/composables/campaignStatus';

const props = defineProps<{ campaign: CampaignDetail }>();
const emit = defineEmits<{
  complete: [];
  start: [];
  saved: [campaign: CampaignRow];
  questCompleted: [result: CompleteResult];
  questDeleted: [id: string];
  // Edit bubbles to the page, which owns the quest edit modal.
  questEdit: [quest: Quest, event: MouseEvent];
  questOpen: [quest: Quest, event: MouseEvent];
}>();

const editing = ref(false);
function onSaved(campaign: CampaignRow) {
  editing.value = false;
  emit('saved', campaign);
}

const rankColor = computed(() => RANK_COLORS[props.campaign.difficulty] ?? '#8a8f98');
const isActive = computed(() => props.campaign.status === 'active');
// Active + clearing share the same affordances; completed locks everything.
const notCompleted = computed(() => props.campaign.status !== 'completed');
const statusLabel = computed(() => CAMPAIGN_STATUS_LABEL[props.campaign.status]);
const statusColor = computed(() => CAMPAIGN_STATUS_COLOR[props.campaign.status]);
const deadlineLabel = computed(() =>
  props.campaign.deadline ? new Date(props.campaign.deadline).toLocaleDateString() : null,
);
const completedLabel = computed(() =>
  props.campaign.completedAt ? new Date(props.campaign.completedAt).toLocaleDateString() : null,
);
const createdLabel = computed(() => new Date(props.campaign.createdAt).toLocaleDateString());
const questCount = computed(() => props.campaign.quests.length);
</script>

<template>
  <CampaignForm
    v-if="editing"
    mode="edit"
    :initial="campaign"
    @updated="onSaved"
    @cancel="editing = false"
  />

  <div v-else class="flex flex-col gap-6">
    <!-- Title row -->
    <header class="flex items-center gap-[0.85rem]">
      <span
        class="grid h-[2.4rem] w-[2.4rem] flex-none place-items-center border bg-panel text-[1.1rem] font-extrabold [text-shadow:0_0_8px_currentColor]"
        :style="{ color: rankColor, borderColor: rankColor }"
      >
        {{ campaign.difficulty }}
      </span>
      <h2 class="m-0 text-[1.6rem] leading-[1.2] text-ink-soft">{{ campaign.title }}</h2>
      <span
        class="flex-none border bg-panel px-[0.6rem] py-[0.2rem] text-[0.68rem] font-bold uppercase tracking-[0.12em]"
        :style="{ color: statusColor, borderColor: statusColor }"
      >
        {{ statusLabel }}
      </span>
    </header>

    <div class="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-7 max-[720px]:grid-cols-1">
      <!-- Main column -->
      <main class="flex min-w-0 flex-col gap-6">
        <section class="flex flex-col gap-[0.6rem]">
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Description</h4>
          <p v-if="campaign.description" class="m-0 whitespace-pre-wrap text-[0.95rem] leading-[1.6] text-ink">{{ campaign.description }}</p>
          <p v-else class="m-0 text-[0.85rem] text-line-soft">No description.</p>
        </section>

        <section class="flex flex-col gap-[0.6rem]">
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Quests <span class="ml-[0.35rem] border border-line bg-[#1a1238] px-[0.4rem] py-[0.05rem] text-[0.7rem] text-[#c9bcff]">{{ questCount }}</span></h4>
          <div v-if="questCount" class="flex flex-col gap-2">
            <QuestCard
              v-for="q in campaign.quests"
              :key="q.id"
              :quest="q"
              selectable
              @open="(quest, event) => emit('questOpen', quest, event)"
              @edit="(quest, event) => emit('questEdit', quest, event)"
              @completed="emit('questCompleted', $event)"
              @deleted="emit('questDeleted', $event)"
            />
          </div>
          <p v-else class="m-0 text-[0.85rem] text-line-soft">No quests in this campaign yet.</p>
        </section>
      </main>

      <!-- Details sidebar -->
      <aside class="flex flex-col gap-4 border border-line bg-[rgba(14,9,30,0.6)] p-4">
        <div v-if="notCompleted" class="flex flex-col gap-2">
          <button
            v-if="isActive"
            class="cursor-pointer border-0 bg-gradient-to-b from-[#2f8fe0] to-[#1f63b8] px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-white shadow-[0_0_14px_rgba(63,167,255,0.4)] hover:brightness-110"
            @click="emit('start')"
          >
            Begin Operation
          </button>
          <button
            class="cursor-pointer border-0 bg-gradient-to-b from-accent-deep to-accent-dark px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-white shadow-[0_0_14px_rgba(124,92,232,0.45)] hover:brightness-110"
            @click="emit('complete')"
          >
            Complete Campaign
          </button>
          <button
            class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-ink hover:brightness-110"
            @click="editing = true"
          >
            Edit
          </button>
        </div>

        <div>
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Details</h4>
          <dl class="mx-0 mb-0 mt-[0.6rem] grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <dt class="text-[0.78rem] text-ink-muted">Rank</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">
              <span
                class="inline-grid h-6 w-6 place-items-center border bg-panel text-[0.8rem] font-extrabold"
                :style="{ color: rankColor, borderColor: rankColor }"
              >
                {{ campaign.difficulty }}
              </span>
            </dd>
            <dt class="text-[0.78rem] text-ink-muted">Status</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink" :style="{ color: statusColor }">{{ statusLabel }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">Quests</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ questCount }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">Deadline</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ deadlineLabel ?? '—' }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">Created</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ createdLabel }}</dd>
            <template v-if="completedLabel">
              <dt class="text-[0.78rem] text-ink-muted">Completed</dt>
              <dd class="m-0 text-right text-[0.85rem] text-ink">{{ completedLabel }}</dd>
            </template>
          </dl>
        </div>
      </aside>
    </div>
  </div>
</template>
