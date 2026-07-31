<script setup lang="ts">
import type { Quest, CompleteResult } from '~/lib/api-client';
import { useQuestActions } from '~/composables/useQuestActions';
import { PRIORITY_STYLES, PRIORITY_DL_CLASS, priorityMarker } from '~/lib/priority';
import { formatDate } from '~/lib/date';

// readonly: a pure preview — no Complete/Edit/Delete, no per-sub-task Edit. Used by the board's
// "DONE TODAY" strip to inspect an already-completed quest (its live entity, full data) without
// any mutation. Un-completing is a separate, deferred concern and is intentionally absent here.
//
// deleted: the DEGRADED variant, for a Chronicles completion whose quest no longer exists (or
// 404'd on fetch). The caller passes a snapshot-shaped Quest (title/rank/xp/completedAt real,
// the rest placeholder) — so this mode shows only those recorded fields plus an honest note,
// and hides the sections the snapshot can't back (description, tags, priority, sub-tasks,
// deadline, created). Always read-only in practice; the two props compose.
const props = defineProps<{ quest: Quest; readonly?: boolean; deleted?: boolean }>();
const emit = defineEmits<{
  completed: [result: CompleteResult];
  deleted: [id: string];
  edit: [quest: Quest, event: MouseEvent];
}>();

const isActive = computed(() => props.quest.status === 'active');
const isCompleted = computed(() => props.quest.status === 'completed');
const deadlineLabel = computed(() => (props.quest.deadline ? formatDate(props.quest.deadline) : null));
const completedLabel = computed(() => (props.quest.completedAt ? formatDate(props.quest.completedAt) : null));
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
    <header class="flex flex-col gap-1.5">
      <div class="flex items-start gap-3">
        <RankBadge :rank="quest.difficulty" class="shrink-0" />
        <h2 class="m-0 min-w-0 flex-1 font-dl-display text-dl-title font-semibold text-dl-ink">{{ quest.title }}</h2>
      </div>
      <!-- Deleted (degraded): an honest note that the quest is gone and only recorded details
           remain. Neutral, not an error — a deletion is a fact, not a failure. -->
      <p v-if="deleted" class="m-0 text-dl-meta text-dl-ink-muted">
        This quest has been deleted — showing recorded details.
      </p>
      <!-- Completed signal: a done check + completion date, so a read-only preview reads as
           "done" at a glance rather than looking like an editable quest. Shown in the deleted
           variant too — the completion is exactly what the snapshot still records. -->
      <p
        v-if="isCompleted && completedLabel"
        class="m-0 flex items-center gap-1.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-lime"
      >
        <span aria-hidden="true">✓</span> Completed {{ completedLabel }}
      </p>
    </header>

    <!-- Actions — hidden entirely in read-only, and only ever shown for an active quest. -->
    <div v-if="isActive && !readonly" class="flex flex-wrap gap-2">
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

    <!-- Description — hidden in the deleted variant (not in the snapshot). -->
    <section v-if="!deleted" class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Description</span>
      <p v-if="quest.description" class="m-0 whitespace-pre-wrap text-dl-body leading-relaxed text-dl-ink">{{ quest.description }}</p>
      <p v-else class="m-0 text-dl-body text-dl-ink-faint">No description.</p>
    </section>

    <!-- Tags -->
    <section v-if="!deleted && quest.tags?.length" class="flex flex-col gap-1.5">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Tags</span>
      <div class="flex flex-wrap gap-1.5">
        <TagChip v-for="tag in quest.tags" :key="tag.id" :name="tag.name" :color="tag.color" />
      </div>
    </section>

    <!-- Sub-quests — hidden in the deleted variant (not in the snapshot). -->
    <section v-if="!deleted" class="flex flex-col gap-1.5">
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
            v-if="st.status === 'active' && !readonly"
            type="button"
            class="dl-focus-inset shrink-0 cursor-pointer border border-dl-grid-line bg-dl-surface px-2 py-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
            @click="emit('edit', st, $event)"
          >Edit</button>
        </div>
      </div>
      <p v-else class="m-0 text-dl-body text-dl-ink-faint">No sub-quests.</p>
    </section>

    <!-- Details. In the deleted variant only the snapshot-backed fields remain (rank in the
         header, XP here); priority/status/deadline/created have no snapshot to show. -->
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-dl-band-line pt-4 font-dl-mono text-dl-label">
      <template v-if="!deleted">
        <dt class="uppercase tracking-wide text-dl-ink-muted">Priority</dt>
        <dd class="m-0 flex items-center justify-end gap-1.5 text-dl-ink">
          <span :class="PRIORITY_DL_CLASS[quest.priority]" aria-hidden="true">{{ priority.glyph }}</span>{{ priority.short }}
        </dd>
        <dt class="uppercase tracking-wide text-dl-ink-muted">Status</dt>
        <dd class="m-0 text-right capitalize text-dl-ink">{{ quest.status }}</dd>
      </template>
      <dt class="uppercase tracking-wide text-dl-ink-muted">XP reward</dt>
      <dd class="m-0 text-right text-dl-ink">+{{ quest.xpReward }} XP</dd>
      <template v-if="!deleted">
        <dt class="uppercase tracking-wide text-dl-ink-muted">Deadline</dt>
        <dd class="m-0 text-right text-dl-ink">{{ deadlineLabel ?? '—' }}</dd>
        <dt class="uppercase tracking-wide text-dl-ink-muted">Created</dt>
        <dd class="m-0 text-right text-dl-ink">{{ createdLabel }}</dd>
      </template>
    </dl>
  </div>
</template>
