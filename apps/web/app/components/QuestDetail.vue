<script setup lang="ts">
import type { Quest, CompleteResult } from '~/lib/api-client';
import { useQuestActions } from '~/composables/useQuestActions';
import { PRIORITY_STYLES, PRIORITY_DL_CLASS, priorityMarker } from '~/lib/priority';
import { formatDate } from '~/lib/date';

const props = defineProps<{ quest: Quest }>();
const emit = defineEmits<{
  completed: [result: CompleteResult];
  deleted: [id: string];
  edit: [quest: Quest, event: MouseEvent];
}>();

const isActive = computed(() => props.quest.status === 'active');
const deadlineLabel = computed(() => (props.quest.deadline ? formatDate(props.quest.deadline) : null));
const createdLabel = computed(() => formatDate(props.quest.createdAt));
const subTasks = computed(() => props.quest.subTasks ?? []);
const priority = computed(() => PRIORITY_STYLES[props.quest.priority]);

const { completing, deleting, errorMsg, onComplete, onDelete } = useQuestActions(() => props.quest, {
  completed: (r) => emit('completed', r),
  deleted: (id) => emit('deleted', id),
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex items-start gap-3">
      <RankBadge :rank="quest.difficulty" class="shrink-0" />
      <h2 class="m-0 min-w-0 flex-1 font-dl-display text-dl-title font-semibold text-dl-ink">{{ quest.title }}</h2>
    </header>

    <!-- Actions -->
    <div v-if="isActive" class="flex flex-wrap gap-2">
      <button
        type="button"
        class="dl-focus-inset cursor-pointer bg-dl-violet px-4 py-2 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
        :class="completing ? 'animate-pulse' : ''"
        :disabled="completing || deleting"
        :aria-busy="completing"
        @click="onComplete"
      >{{ completing ? 'Completing…' : 'Complete' }}</button>
      <button
        type="button"
        class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink disabled:opacity-60"
        :disabled="completing || deleting"
        @click="emit('edit', quest, $event)"
      >Edit</button>
      <button
        type="button"
        class="dl-focus-inset cursor-pointer border border-dl-magenta bg-transparent px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-magenta hover:bg-dl-magenta/10 disabled:opacity-60"
        :disabled="completing || deleting"
        @click="onDelete"
      >{{ deleting ? 'Deleting…' : 'Delete' }}</button>
    </div>
    <p v-if="errorMsg" class="m-0 text-dl-meta text-dl-magenta">{{ errorMsg }}</p>

    <!-- Description -->
    <section class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Description</span>
      <p v-if="quest.description" class="m-0 whitespace-pre-wrap text-dl-body leading-relaxed text-dl-ink">{{ quest.description }}</p>
      <p v-else class="m-0 text-dl-body text-dl-ink-faint">No description.</p>
    </section>

    <!-- Tags -->
    <section v-if="quest.tags?.length" class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Tags</span>
      <div class="flex flex-wrap gap-1.5">
        <TagChip v-for="tag in quest.tags" :key="tag.id" :name="tag.name" :color="tag.color" />
      </div>
    </section>

    <!-- Sub-quests -->
    <section class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Sub-quests · {{ subTasks.length }}</span>
      <div v-if="subTasks.length" class="flex flex-col gap-1">
        <div v-for="st in subTasks" :key="st.id" class="flex items-center gap-2 border border-dl-hairline bg-dl-surface px-3 py-2">
          <span class="min-w-0 flex-1 truncate text-dl-body" :class="st.status === 'active' ? 'text-dl-ink' : 'text-dl-ink-faint line-through'">{{ st.title }}</span>
          <span
            v-if="priorityMarker(st.priority)"
            class="shrink-0 text-dl-meta leading-none"
            :class="PRIORITY_DL_CLASS[st.priority]"
            aria-hidden="true"
          >{{ priorityMarker(st.priority)?.glyph }}</span>
          <RankBadge :rank="st.difficulty" class="shrink-0" />
          <button
            v-if="st.status === 'active'"
            type="button"
            class="dl-focus-inset shrink-0 cursor-pointer border border-dl-grid-line bg-dl-surface px-2 py-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
            @click="emit('edit', st, $event)"
          >Edit</button>
        </div>
      </div>
      <p v-else class="m-0 text-dl-body text-dl-ink-faint">No sub-quests.</p>
    </section>

    <!-- Details -->
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-dl-band-line pt-4 font-dl-mono text-dl-label">
      <dt class="uppercase tracking-wide text-dl-ink-muted">Priority</dt>
      <dd class="m-0 flex items-center justify-end gap-1.5 text-dl-ink">
        <span :class="PRIORITY_DL_CLASS[quest.priority]" aria-hidden="true">{{ priority.glyph }}</span>{{ priority.short }}
      </dd>
      <dt class="uppercase tracking-wide text-dl-ink-muted">Status</dt>
      <dd class="m-0 text-right capitalize text-dl-ink">{{ quest.status }}</dd>
      <dt class="uppercase tracking-wide text-dl-ink-muted">XP reward</dt>
      <dd class="m-0 text-right text-dl-ink">+{{ quest.xpReward }} XP</dd>
      <dt class="uppercase tracking-wide text-dl-ink-muted">Deadline</dt>
      <dd class="m-0 text-right text-dl-ink">{{ deadlineLabel ?? '—' }}</dd>
      <dt class="uppercase tracking-wide text-dl-ink-muted">Created</dt>
      <dd class="m-0 text-right text-dl-ink">{{ createdLabel }}</dd>
    </dl>
  </div>
</template>
