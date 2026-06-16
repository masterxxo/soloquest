<script setup lang="ts">
import { client, type Quest } from '~/lib/api-client';

const emit = defineEmits<{ created: [quest: Quest] }>();

const DIFFICULTIES = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

const title = ref('');
const description = ref('');
const difficulty = ref<(typeof DIFFICULTIES)[number]>('E');
const deadline = ref(''); // yyyy-mm-dd from <input type="date">
const submitting = ref(false);
const errorMsg = ref<string | null>(null);

async function onSubmit() {
  submitting.value = true;
  errorMsg.value = null;
  try {
    const res = await client.api.quests.$post({
      json: {
        title: title.value,
        description: description.value,
        difficulty: difficulty.value,
        // Date | undefined — hc serialises to ISO, the backend coerces it back.
        deadline: deadline.value ? new Date(deadline.value) : undefined,
      },
    });
    if (!res.ok) {
      errorMsg.value = 'Could not create quest. Check the fields and try again.';
      return;
    }
    emit('created', await res.json());
    title.value = '';
    description.value = '';
    difficulty.value = 'E';
    deadline.value = '';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="quest-form" @submit.prevent="onSubmit">
    <p class="tag">[ NEW QUEST ]</p>

    <input v-model="title" type="text" placeholder="Title" required maxlength="255" />
    <textarea v-model="description" placeholder="Description" required rows="2" />

    <div class="row">
      <label>
        Rank
        <select v-model="difficulty">
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label>
        Deadline
        <input v-model="deadline" type="date" />
      </label>
    </div>

    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

    <button type="submit" :disabled="submitting">
      {{ submitting ? 'Issuing…' : 'Issue quest' }}
    </button>
  </form>
</template>

<style scoped>
.quest-form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
  background: rgba(8, 16, 36, 0.7);
  border: 1px solid #213663;
  border-radius: 10px;
}
.tag { margin: 0; letter-spacing: 0.3em; font-size: 0.7rem; color: #5b8bff; }
input, textarea, select {
  padding: 0.55rem 0.7rem;
  background: #060c1c;
  border: 1px solid #29407e;
  border-radius: 6px;
  color: #eaf2ff;
  font: inherit;
  font-size: 0.9rem;
  outline: none;
}
input:focus, textarea:focus, select:focus {
  border-color: #5b8bff;
  box-shadow: 0 0 0 2px rgba(91, 139, 255, 0.25);
}
textarea { resize: vertical; }
.row { display: flex; gap: 0.7rem; }
.row label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #9bb4e6;
}
.err { margin: 0; font-size: 0.78rem; color: #ff8080; }
button {
  padding: 0.6rem;
  background: linear-gradient(180deg, #2f6bff, #1d3fb8);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 14px rgba(56, 120, 255, 0.45);
}
button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
