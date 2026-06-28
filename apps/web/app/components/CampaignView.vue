<script setup lang="ts">
import {
  type CampaignDetail,
  type CampaignRow,
  type CompleteResult,
  type Quest,
  type QuestWithWarnings,
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
  questUpdated: [result: QuestWithWarnings];
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

  <div v-else class="cv">
    <!-- Title row -->
    <header class="cv-head">
      <span class="rank" :style="{ color: rankColor, borderColor: rankColor }">
        {{ campaign.difficulty }}
      </span>
      <h2 class="cv-title">{{ campaign.title }}</h2>
      <span
        class="status-pill"
        :style="{ color: statusColor, borderColor: statusColor }"
      >
        {{ statusLabel }}
      </span>
    </header>

    <div class="cv-grid">
      <!-- Main column -->
      <main class="cv-main">
        <section class="cv-section">
          <h4 class="cv-label">Description</h4>
          <p v-if="campaign.description" class="cv-desc">{{ campaign.description }}</p>
          <p v-else class="cv-empty">No description.</p>
        </section>

        <section class="cv-section">
          <h4 class="cv-label">Quests <span class="cv-count">{{ questCount }}</span></h4>
          <div v-if="questCount" class="cv-quests">
            <QuestCard
              v-for="q in campaign.quests"
              :key="q.id"
              :quest="q"
              selectable
              @open="(quest, event) => emit('questOpen', quest, event)"
              @completed="emit('questCompleted', $event)"
              @deleted="emit('questDeleted', $event)"
              @updated="emit('questUpdated', $event)"
            />
          </div>
          <p v-else class="cv-empty">No quests in this campaign yet.</p>
        </section>
      </main>

      <!-- Details sidebar -->
      <aside class="cv-side">
        <div v-if="notCompleted" class="cv-actions">
          <button v-if="isActive" class="start" @click="emit('start')">Begin Operation</button>
          <button class="complete" @click="emit('complete')">Complete Campaign</button>
          <button class="edit" @click="editing = true">Edit</button>
        </div>

        <div class="cv-details">
          <h4 class="cv-label">Details</h4>
          <dl>
            <dt>Rank</dt>
            <dd>
              <span class="rank-inline" :style="{ color: rankColor, borderColor: rankColor }">
                {{ campaign.difficulty }}
              </span>
            </dd>
            <dt>Status</dt>
            <dd :style="{ color: statusColor }">{{ statusLabel }}</dd>
            <dt>Quests</dt>
            <dd>{{ questCount }}</dd>
            <dt>Deadline</dt>
            <dd>{{ deadlineLabel ?? '—' }}</dd>
            <dt>Created</dt>
            <dd>{{ createdLabel }}</dd>
            <template v-if="completedLabel">
              <dt>Completed</dt>
              <dd>{{ completedLabel }}</dd>
            </template>
          </dl>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cv { display: flex; flex-direction: column; gap: 1.5rem; }

.cv-head { display: flex; align-items: center; gap: 0.85rem; }
.cv-title { margin: 0; font-size: 1.6rem; line-height: 1.2; color: #ece8fb; }
.status-pill {
  flex: 0 0 auto;
  padding: 0.2rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 1px solid;
  background: #0a0618;
}
.rank {
  flex: 0 0 auto;
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1.1rem;
  border: 1px solid;
  background: #0a0618;
  text-shadow: 0 0 8px currentColor;
}

/* Two panes: wide main column + fixed details rail. Stacks on narrow widths. */
.cv-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 1.75rem;
  align-items: start;
}
@media (max-width: 720px) {
  .cv-grid { grid-template-columns: 1fr; }
}

.cv-main { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }
.cv-section { display: flex; flex-direction: column; gap: 0.6rem; }
.cv-label {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8174b8;
}
.cv-count {
  margin-left: 0.35rem;
  padding: 0.05rem 0.4rem;
  font-size: 0.7rem;
  color: #c9bcff;
  background: #1a1238;
  border: 1px solid #2a2050;
}
.cv-desc {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #d0c8f8;
  white-space: pre-wrap;
}
.cv-empty { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
.cv-quests { display: flex; flex-direction: column; gap: 0.5rem; }

/* Sidebar */
.cv-side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
}
.cv-actions { display: flex; flex-direction: column; gap: 0.5rem; }
.cv-actions .complete {
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  background: linear-gradient(180deg, #6a4fd8, #4a35a8);
  color: #fff;
  border: none;
  box-shadow: 0 0 14px rgba(124, 92, 232, 0.45);
}
.cv-actions .start {
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  background: linear-gradient(180deg, #2f8fe0, #1f63b8);
  color: #fff;
  border: none;
  box-shadow: 0 0 14px rgba(63, 167, 255, 0.4);
}
.cv-actions .edit {
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  background: transparent;
  color: #d0c8f8;
  border: 1px solid #2a2050;
}
.cv-actions button:hover { filter: brightness(1.1); }

.cv-details dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 0.75rem;
  margin: 0.6rem 0 0;
}
.cv-details dt { font-size: 0.78rem; color: #8174b8; }
.cv-details dd { margin: 0; font-size: 0.85rem; color: #d0c8f8; text-align: right; }
.rank-inline {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  font-weight: 800;
  font-size: 0.8rem;
  border: 1px solid;
  background: #0a0618;
}
</style>
