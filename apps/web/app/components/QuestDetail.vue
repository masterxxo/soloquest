<script setup lang="ts">
import { type Quest, type CompleteResult, type QuestWithWarnings } from '~/lib/api-client';
import { useQuestActions, RANK_COLORS } from '~/composables/useQuestActions';

const props = withDefaults(
  defineProps<{
    quest: Quest;
    // Resolved by the parent from the campaign list — we never render the raw id.
    campaignName?: string | null;
  }>(),
  { campaignName: null },
);
const emit = defineEmits<{
  completed: [result: CompleteResult];
  deleted: [id: string];
  updated: [result: QuestWithWarnings];
}>();

const editing = ref(false);
const isActive = computed(() => props.quest.status === 'active');

const rankColor = computed(() => RANK_COLORS[props.quest.difficulty] ?? '#8a8f98');
const deadlineLabel = computed(() =>
  props.quest.deadline ? new Date(props.quest.deadline).toLocaleDateString() : null,
);
const createdLabel = computed(() => new Date(props.quest.createdAt).toLocaleDateString());
const subCount = computed(() => props.quest.subTasks?.length ?? 0);

function onUpdated(result: QuestWithWarnings) {
  editing.value = false;
  emit('updated', result);
}

const { completing, deleting, errorMsg, onComplete, onDelete } = useQuestActions(
  () => props.quest,
  { completed: (r) => emit('completed', r), deleted: (id) => emit('deleted', id) },
);
</script>

<template>
  <QuestForm
    v-if="editing"
    mode="edit"
    :initial="quest"
    @updated="onUpdated"
    @cancel="editing = false"
  />

  <div v-else class="qd">
    <!-- Title row -->
    <header class="qd-head">
      <span class="rank" :style="{ color: rankColor, borderColor: rankColor }">
        {{ quest.difficulty }}
      </span>
      <h2 class="qd-title">{{ quest.title }}</h2>
    </header>

    <div class="qd-grid">
      <!-- Main column -->
      <main class="qd-main">
        <section class="qd-section">
          <h4 class="qd-label">Description</h4>
          <p v-if="quest.description" class="qd-desc">{{ quest.description }}</p>
          <p v-else class="qd-empty">No description.</p>
        </section>

        <section class="qd-section">
          <h4 class="qd-label">Sub-quests <span class="qd-count">{{ subCount }}</span></h4>
          <div v-if="subCount" class="qd-subs">
            <QuestCard
              v-for="st in quest.subTasks"
              :key="st.id"
              :quest="st"
              is-sub-task
              :parent-name="quest.title"
              @updated="emit('updated', $event)"
            />
          </div>
          <p v-else class="qd-empty">No sub-quests.</p>
        </section>
      </main>

      <!-- Details sidebar -->
      <aside class="qd-side">
        <div class="qd-actions">
          <button
            v-if="isActive"
            class="complete"
            :disabled="completing || deleting"
            @click="onComplete"
          >
            {{ completing ? '…' : 'Complete' }}
          </button>
          <button
            v-if="isActive"
            class="edit"
            :disabled="completing || deleting"
            @click="editing = true"
          >
            Edit
          </button>
          <button class="delete" :disabled="completing || deleting" @click="onDelete">
            {{ deleting ? '…' : 'Delete' }}
          </button>
        </div>
        <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

        <div class="qd-details">
          <h4 class="qd-label">Details</h4>
          <dl>
            <dt>Rank</dt>
            <dd>
              <span class="rank-inline" :style="{ color: rankColor, borderColor: rankColor }">
                {{ quest.difficulty }}
              </span>
            </dd>
            <dt>Status</dt>
            <dd class="cap">{{ quest.status }}</dd>
            <dt>XP reward</dt>
            <dd class="xp">+{{ quest.xpReward }} XP</dd>
            <dt>Deadline</dt>
            <dd>{{ deadlineLabel ?? '—' }}</dd>
            <dt>Campaign</dt>
            <dd>{{ campaignName ?? '—' }}</dd>
            <dt>Created</dt>
            <dd>{{ createdLabel }}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.qd { display: flex; flex-direction: column; gap: 1.5rem; }

.qd-head { display: flex; align-items: center; gap: 0.85rem; }
.qd-title { margin: 0; font-size: 1.6rem; line-height: 1.2; color: #ece8fb; }
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
.qd-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 1.75rem;
  align-items: start;
}
@media (max-width: 720px) {
  .qd-grid { grid-template-columns: 1fr; }
}

.qd-main { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }
.qd-section { display: flex; flex-direction: column; gap: 0.6rem; }
.qd-label {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8174b8;
}
.qd-count {
  margin-left: 0.35rem;
  padding: 0.05rem 0.4rem;
  font-size: 0.7rem;
  color: #c9bcff;
  background: #1a1238;
  border: 1px solid #2a2050;
}
.qd-desc {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #d0c8f8;
  white-space: pre-wrap;
}
.qd-empty { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
.qd-subs { display: flex; flex-direction: column; gap: 0.5rem; }

/* Sidebar */
.qd-side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
}
.qd-actions { display: flex; flex-direction: column; gap: 0.5rem; }
.qd-actions button {
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid #2a2050;
}
.qd-actions .complete {
  background: linear-gradient(180deg, #6a4fd8, #4a35a8);
  color: #fff;
  border: none;
  box-shadow: 0 0 14px rgba(124, 92, 232, 0.45);
}
.qd-actions .edit { background: transparent; color: #d0c8f8; }
.qd-actions .delete { background: transparent; color: #ff8080; border-color: #5a2740; }
.qd-actions button:hover:not(:disabled) { filter: brightness(1.1); }
.qd-actions button:disabled { opacity: 0.55; cursor: not-allowed; }
.err { margin: 0; font-size: 0.78rem; color: #ff8080; }

.qd-details dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 0.75rem;
  margin: 0.6rem 0 0;
}
.qd-details dt { font-size: 0.78rem; color: #8174b8; }
.qd-details dd { margin: 0; font-size: 0.85rem; color: #d0c8f8; text-align: right; }
.qd-details .cap { text-transform: capitalize; }
.qd-details .xp { color: #9c7cff; font-weight: 600; }
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
