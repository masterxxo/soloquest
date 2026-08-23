<script setup lang="ts">
import { client, type QuestWithWarnings, type QuestTag } from '~/lib/api-client';
import { readApiError } from '~/lib/api-error';
import { useFeedbackStore } from '~/stores/feedback';
import type { Difficulty } from '@soloquest/shared';

// Inline quick-add: a title-only field at rest that expands to the full capture (rank E–S, a
// deadline, and tags) on focus, then posts a real quest. It owns its own POST and emits the
// created quest for the page to fold into the store — the same shape the New Quest modal emits.
// The heavier fields (description, parent, sub-tasks) stay in that modal; this is the fast path.
const emit = defineEmits<{ created: [result: QuestWithWarnings] }>();

const feedback = useFeedbackStore();

const title = ref('');
const difficulty = ref<Difficulty>('E');
const deadline = ref(''); // yyyy-mm-dd from <input type="date">; '' = no deadline
const selectedTags = ref<QuestTag[]>([]);
const expanded = ref(false);
const submitting = ref(false);
const titleEl = ref<HTMLInputElement | null>(null);

function expand() {
  expanded.value = true;
}

// Collapse back to the resting field, discarding the in-progress capture. Only auto-collapses
// when nothing has been entered, so a stray blur can't wipe a half-typed quest.
function collapse() {
  expanded.value = false;
  title.value = '';
  difficulty.value = 'E';
  deadline.value = '';
  selectedTags.value = [];
}
function onTitleBlur() {
  if (!title.value.trim() && !selectedTags.value.length && !deadline.value) expanded.value = false;
}

async function submit() {
  const trimmed = title.value.trim();
  if (!trimmed || submitting.value) return;
  submitting.value = true;
  try {
    const res = await client.api.quests.$post({
      json: {
        title: trimmed,
        difficulty: difficulty.value,
        deadline: deadline.value ? new Date(deadline.value) : null,
        tagIds: selectedTags.value.map((t) => t.id),
      },
    });
    if (!res.ok) {
      const { message } = await readApiError(res, 'Could not create quest.');
      feedback.showError(message);
      return;
    }
    emit('created', await res.json());
    collapse();
    nextTick(() => titleEl.value?.focus());
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="border border-dl-grid-line bg-dl-surface" @submit.prevent="submit">
    <!-- Resting / title row. -->
    <div class="flex h-dl-row items-center gap-2 px-3">
      <span class="shrink-0 text-dl-ink-faint" aria-hidden="true">+</span>
      <input
        ref="titleEl"
        v-model="title"
        type="text"
        maxlength="255"
        placeholder="Add a quest…"
        class="min-w-0 flex-1 border-0 bg-transparent p-0 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint"
        @focus="expand"
        @blur="onTitleBlur"
      />
      <span v-if="!expanded" class="shrink-0 font-dl-mono text-dl-label text-dl-ink-faint" aria-hidden="true">⏎</span>
    </div>

    <!-- Active detail row. -->
    <div v-if="expanded" class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dl-hairline px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Rank</span>
        <RankSelector :selected="[difficulty]" label="Rank" @toggle="difficulty = $event" />
      </div>

      <input
        v-model="deadline"
        type="date"
        aria-label="Deadline"
        class="dl-focus-inset min-h-dl-touch border border-dl-grid-line bg-dl-surface px-2 py-1 font-dl-mono text-dl-meta text-dl-ink outline-none md:min-h-0"
      />

      <TagCombobox v-model="selectedTags" compact placeholder="+ Tag" />

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-1.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted transition-colors hover:bg-dl-sunk hover:text-dl-ink"
          @click="collapse"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="submitting || !title.trim()"
          class="dl-focus-inset cursor-pointer bg-dl-violet px-4 py-1.5 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ submitting ? '…' : 'Add' }}
        </button>
      </div>
    </div>
  </form>
</template>
