<script setup lang="ts">
import { client, type Quest, type CompleteResult } from '~/lib/api-client';

const props = defineProps<{ quest: Quest }>();
const emit = defineEmits<{ completed: [result: CompleteResult]; deleted: [id: string] }>();

const completing = ref(false);
const deleting = ref(false);
const errorMsg = ref<string | null>(null);

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
  <article class="quest">
    <span class="rank" :style="{ color: rankColor, borderColor: rankColor }">
      {{ quest.difficulty }}
    </span>

    <div class="body">
      <h3>{{ quest.title }}</h3>
      <p v-if="quest.description" class="desc">{{ quest.description }}</p>
      <div class="meta">
        <span class="xp">+{{ quest.xpReward }} XP</span>
        <span v-if="deadlineLabel" class="deadline">⌛ {{ deadlineLabel }}</span>
      </div>
      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
    </div>

    <div class="actions">
      <button class="complete" :disabled="completing || deleting" @click="onComplete">
        {{ completing ? '…' : 'Complete' }}
      </button>
      <button class="delete" :disabled="completing || deleting" @click="onDelete" aria-label="Delete quest">
        {{ deleting ? '…' : '✕' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.quest {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  padding: 1rem;
  background: rgba(8, 16, 36, 0.7);
  border: 1px solid #213663;
  border-radius: 10px;
}
.rank {
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1rem;
  border: 1px solid;
  border-radius: 8px;
  background: #060c1c;
  text-shadow: 0 0 8px currentColor;
}
.body { flex: 1 1 auto; min-width: 0; }
h3 { margin: 0; font-size: 1rem; color: #eaf2ff; }
.desc { margin: 0.25rem 0 0.5rem; font-size: 0.85rem; color: #9bb4e6; }
.meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #8fa9d8; }
.xp { color: #5b8bff; font-weight: 600; }
.err { margin: 0.4rem 0 0; font-size: 0.75rem; color: #ff8080; }
.actions { display: flex; gap: 0.4rem; flex: 0 0 auto; }
button {
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid #2a4dd0;
}
.complete { background: linear-gradient(180deg, #2f6bff, #1d3fb8); color: #fff; border: none; }
.delete { background: transparent; color: #ff8080; border-color: #5a2740; }
button:hover:not(:disabled) { filter: brightness(1.1); }
button:disabled { opacity: 0.55; cursor: not-allowed; }
</style>
