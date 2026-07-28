<script setup lang="ts">
import type { Quest, CompleteResult } from '~/lib/api-client';
import { useQuestActions } from '~/composables/useQuestActions';
import { priorityMarker, PRIORITY_DL_CLASS } from '~/lib/priority';
import { localDateString } from '~/lib/date';

// The Daylight quest row — the list's atomic unit (56px; sub-tasks 40/44). It is a NEW
// component, not a re-skin of QuestCard: QuestCard still renders the grimoire QuestDetail
// sub-task list, so the two evolve independently until that surface migrates.
//
// Anatomy (groups, not a flat list): a 3px status stripe on the leading edge, then checkbox →
// title (grows, wins width). Pinned to the right: tags → priority glyph → RankBadge. When space
// runs short the tags yield first (collapse to a "+N" counter) and the title yields last; the
// RankBadge and priority glyph never disappear. Completion is the checkbox; the title opens the
// detail modal (where edit/delete live) — no per-row action buttons, per the design.
const props = withDefaults(
  defineProps<{
    quest: Quest;
    isSubTask?: boolean;
    // Title becomes a button that emits `open` (the list opens detail); forwarded to sub-tasks.
    selectable?: boolean;
    // Render nested sub-tasks. The list's "Hide sub-tasks" filter turns this off.
    showSubTasks?: boolean;
  }>(),
  { isSubTask: false, selectable: false, showSubTasks: true },
);
const emit = defineEmits<{
  completed: [result: CompleteResult];
  deleted: [id: string];
  open: [quest: Quest, event: MouseEvent];
}>();

const isActive = computed(() => props.quest.status === 'active');
const isDone = computed(() => props.quest.status !== 'active');

// Leading status stripe. Only overdue/today/done carry a signal colour; everything else keeps a
// neutral rail so every row reads as framed. Derived from the quest itself (deadline in the
// user's local day), so it stays correct even inside a nested sub-task.
const state = computed<'overdue' | 'today' | 'done' | 'none'>(() => {
  if (isDone.value) return 'done';
  const dl = props.quest.deadline;
  if (!dl) return 'none';
  const day = localDateString(new Date(dl));
  const today = localDateString();
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  return 'none';
});
const stripeClass = computed(
  () =>
    ({
      overdue: 'bg-dl-magenta',
      today: 'bg-dl-violet',
      done: 'bg-dl-lime',
      none: 'bg-dl-grid-line',
    })[state.value],
);

// High/low get a chevron beside the rank; normal renders nothing.
const marker = computed(() => priorityMarker(props.quest.priority));

// Tags: one full chip + a "+N" counter for the rest — collapses cleanly and matches the mobile
// "one chip + counter" rule without needing per-breakpoint measurement.
const tags = computed(() => props.quest.tags ?? []);
const firstTag = computed(() => tags.value[0]);
const extraTagCount = computed(() => Math.max(0, tags.value.length - 1));

const { completing, errorMsg, onComplete } = useQuestActions(
  () => props.quest,
  { completed: (r) => emit('completed', r), deleted: (id) => emit('deleted', id) },
);

// Row height: 56px top-level; sub-tasks 44 (touch) / 40 (pointer).
const rowHeight = computed(() =>
  props.isSubTask ? 'h-dl-subrow-touch md:h-dl-subrow' : 'h-dl-row',
);
</script>

<template>
  <div class="flex flex-col">
    <div
      class="relative flex items-center gap-2 border border-dl-hairline bg-dl-surface pl-3 pr-2 md:gap-3"
      :class="rowHeight"
    >
      <!-- 3px leading status stripe. -->
      <span class="absolute inset-y-0 left-0 w-[3px]" :class="stripeClass" aria-hidden="true" />

      <!-- Checkbox — completes the quest. 44px touch target; a 20px cut box inside. -->
      <button
        v-if="isActive"
        type="button"
        role="checkbox"
        :aria-checked="false"
        :aria-label="`Complete ${quest.title}`"
        :disabled="completing"
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center disabled:cursor-not-allowed md:min-h-0 md:min-w-0"
        :class="completing ? 'animate-pulse' : 'cursor-pointer'"
        @click="onComplete"
      >
        <span
          class="corner-cut-sm grid h-5 w-5 place-items-center border border-dl-band-line bg-dl-surface text-dl-violet transition-colors duration-dl-standard ease-dl hover:border-dl-violet"
        >
          <span v-if="completing" class="text-dl-label leading-none">…</span>
        </span>
      </button>
      <!-- Done: a filled lime check (appears during the optimistic gap before the row leaves). -->
      <span
        v-else
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center md:min-h-0 md:min-w-0"
        aria-hidden="true"
      >
        <span class="corner-cut-sm grid h-5 w-5 place-items-center border border-dl-lime bg-dl-lime/20 text-[0.7rem] leading-none text-dl-ink">✓</span>
      </span>

      <!-- Title — grows, wins width. Opens detail when selectable. -->
      <button
        v-if="selectable"
        type="button"
        class="dl-focus-inset min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-dl-body text-dl-ink [font:inherit] hover:text-dl-violet"
        :class="isDone ? 'text-dl-ink-faint line-through' : ''"
        @click="emit('open', quest, $event)"
      >
        {{ quest.title }}
      </button>
      <span
        v-else
        class="min-w-0 flex-1 truncate text-dl-body text-dl-ink"
        :class="isDone ? 'text-dl-ink-faint line-through' : ''"
      >{{ quest.title }}</span>

      <!-- Pinned right: tags → priority glyph → RankBadge. -->
      <div class="flex shrink-0 items-center gap-2">
        <div v-if="firstTag" class="flex min-w-0 items-center gap-1">
          <TagChip :name="firstTag.name" :color="firstTag.color" />
          <span v-if="extraTagCount" class="font-dl-mono text-dl-label text-dl-ink-faint">+{{ extraTagCount }}</span>
        </div>
        <span
          v-if="marker"
          class="shrink-0 text-dl-meta leading-none"
          :class="PRIORITY_DL_CLASS[quest.priority]"
          :title="marker.label"
          :aria-label="marker.label"
          role="img"
        >{{ marker.glyph }}</span>
        <RankBadge :rank="quest.difficulty" class="shrink-0" />
      </div>
    </div>

    <p v-if="errorMsg" class="mt-1 pl-3 text-dl-meta text-dl-magenta">{{ errorMsg }}</p>

    <!-- Nested sub-tasks: indented ~30px, same anatomy at a smaller scale. Capped at one level
         (`show-sub-tasks="false"`), so a row can never recurse into itself. -->
    <div v-if="showSubTasks && quest.subTasks?.length" class="mt-1 flex flex-col gap-1 pl-[30px]">
      <QuestRow
        v-for="st in quest.subTasks"
        :key="st.id"
        :quest="st"
        is-sub-task
        :selectable="selectable"
        :show-sub-tasks="false"
        @open="(q, e) => emit('open', q, e)"
        @completed="(r) => emit('completed', r)"
        @deleted="(id) => emit('deleted', id)"
      />
    </div>
  </div>
</template>
