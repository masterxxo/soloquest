<script setup lang="ts">
import { client, type Quest, type CompleteResult, type QuestWithWarnings } from '~/lib/api-client';

const props = withDefaults(
  defineProps<{
    quest: Quest;
    isSubTask?: boolean;
    // Resolved by the parent from the campaign list — we never render the raw id.
    campaignName?: string | null;
    // For a sub-task, the title of the quest it belongs to.
    parentName?: string | null;
  }>(),
  { isSubTask: false, campaignName: null, parentName: null },
);
const emit = defineEmits<{
  completed: [result: CompleteResult];
  deleted: [id: string];
  updated: [result: QuestWithWarnings];
}>();

const completing = ref(false);
const deleting = ref(false);
const editing = ref(false);
const errorMsg = ref<string | null>(null);

// Only active quests can be edited/completed (mirrors the backend guard).
const isActive = computed(() => props.quest.status === 'active');

function onUpdated(result: QuestWithWarnings) {
  editing.value = false;
  emit('updated', result);
}

// Solo Leveling rank colours, E (weakest) → S (strongest).
const RANK_COLORS: Record<string, string> = {
  E: '#8a8f98', D: '#3fbf6f', C: '#2f6bff', B: '#9a5bff', A: '#ff9a3c', S: '#ffcf3c',
};
const rankColor = computed(() => RANK_COLORS[props.quest.difficulty] ?? '#8a8f98');

const deadlineLabel = computed(() =>
  props.quest.deadline ? new Date(props.quest.deadline).toLocaleDateString() : null,
);

async function onComplete() {
  completing.value = true;
  errorMsg.value = null;
  try {
    const res = await client.api.quests[':id'].complete.$post({ param: { id: props.quest.id } });
    if (!res.ok) {
      errorMsg.value = res.status === 409 ? 'Already completed.' : 'Could not complete quest.';
      return;
    }
    emit('completed', await res.json());
  } finally {
    completing.value = false;
  }
}

async function onDelete() {
  if (!confirm(`Delete quest "${props.quest.title}"?`)) return;
  deleting.value = true;
  errorMsg.value = null;
  try {
    const res = await client.api.quests[':id'].$delete({ param: { id: props.quest.id } });
    if (!res.ok) {
      errorMsg.value = 'Could not delete quest.';
      return;
    }
    emit('deleted', props.quest.id);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="quest-wrap">
    <QuestForm
      v-if="editing"
      mode="edit"
      :initial="quest"
      @updated="onUpdated"
      @cancel="editing = false"
    />

    <article v-else class="quest">
      <span class="rank" :style="{ color: rankColor, borderColor: rankColor }">
        {{ quest.difficulty }}
      </span>

      <div class="body">
        <h3>{{ quest.title }}</h3>
        <!-- Names only — the raw id is never shown; the line is hidden until the
             parent resolves a name. -->
        <div v-if="campaignName || parentName" class="rel-meta">
          <span v-if="campaignName">Campaign: {{ campaignName }}</span>
          <span v-if="parentName">Sub-task of: {{ parentName }}</span>
        </div>
        <p v-if="quest.description" class="desc">{{ quest.description }}</p>
        <div class="meta">
          <span class="xp">+{{ quest.xpReward }} XP</span>
          <span v-if="deadlineLabel" class="deadline">⌛ {{ deadlineLabel }}</span>
        </div>
        <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
      </div>

      <div class="actions">
        <button
          v-if="isActive"
          class="edit"
          :disabled="completing || deleting"
          @click="editing = true"
        >
          Edit
        </button>
        <!-- Sub-tasks only expose Edit; Complete/Delete stay on the top-level quest. -->
        <button
          v-if="isActive && !isSubTask"
          class="complete"
          :disabled="completing || deleting"
          @click="onComplete"
        >
          {{ completing ? '…' : 'Complete' }}
        </button>
        <button
          v-if="!isSubTask"
          class="delete"
          :disabled="completing || deleting"
          @click="onDelete"
          aria-label="Delete quest"
        >
          {{ deleting ? '…' : '✕' }}
        </button>
      </div>
    </article>

    <!-- Nested sub-tasks render as the same card with reduced actions. -->
    <div v-if="quest.subTasks?.length" class="subtasks">
      <QuestCard
        v-for="st in quest.subTasks"
        :key="st.id"
        :quest="st"
        is-sub-task
        :parent-name="quest.title"
        @updated="emit('updated', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.quest-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
.quest {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.6rem 0.8rem;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
  border-radius: 0;
}
.rank {
  flex: 0 0 auto;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.9rem;
  border: 1px solid;
  border-radius: 0;
  background: #0a0618;
  text-shadow: 0 0 8px currentColor;
}
.body { flex: 1 1 auto; min-width: 0; }
h3 { margin: 0; font-size: 0.95rem; color: #ece8fb; }
.rel-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.15rem; font-size: 0.7rem; color: #6a5da0; }
/* Clamp long descriptions to 2 lines so one quest can't dominate the list. */
.desc {
  margin: 0.2rem 0 0.3rem;
  font-size: 0.85rem;
  color: #8174b8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #8174b8; }
.xp { color: #9c7cff; font-weight: 600; }
.err { margin: 0.4rem 0 0; font-size: 0.75rem; color: #ff8080; }
.actions { display: flex; gap: 0.4rem; flex: 0 0 auto; }
button {
  padding: 0.35rem 0.65rem;
  border-radius: 0;
  font-weight: 600;
  font-size: 0.78rem;
  cursor: pointer;
  border: 1px solid #2a2050;
}
.edit { background: transparent; color: #d0c8f8; border-color: #2a2050; }
.complete { background: linear-gradient(180deg, #6a4fd8, #4a35a8); color: #fff; border: none; }
.delete { background: transparent; color: #ff8080; border-color: #5a2740; }
button:hover:not(:disabled) { filter: brightness(1.1); }
button:disabled { opacity: 0.55; cursor: not-allowed; }

/* Nested sub-tasks: indented and dimmed slightly to read as children. */
.subtasks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-left: 1.25rem;
  padding-left: 0.75rem;
  border-left: 1px solid #2a2050;
}
</style>
