<script setup lang="ts">
import { type Quest, type CompleteResult } from '~/lib/api-client';
import { useQuestActions } from '~/composables/useQuestActions';
import { rankColor } from '~/lib/ranks';
import { formatDate } from '~/lib/date';

const props = withDefaults(
  defineProps<{
    quest: Quest;
    isSubTask?: boolean;
    // For a sub-task, the title of the quest it belongs to.
    parentName?: string | null;
    // Title becomes a button that emits `open` (used by the list to open detail).
    selectable?: boolean;
  }>(),
  { isSubTask: false, parentName: null, selectable: false },
);
const emit = defineEmits<{
  completed: [result: CompleteResult];
  deleted: [id: string];
  // Edit / open the detail — both bubble to the page, which owns the modals.
  open: [quest: Quest, event: MouseEvent];
  edit: [quest: Quest, event: MouseEvent];
}>();

// Top-level list cards open a detail view; sub-tasks don't.
const openable = computed(() => props.selectable && !props.isSubTask);

// Only active quests can be edited/completed (mirrors the backend guard).
const isActive = computed(() => props.quest.status === 'active');

const color = computed(() => rankColor(props.quest.difficulty));

const deadlineLabel = computed(() =>
  props.quest.deadline ? formatDate(props.quest.deadline) : null,
);

const { completing, deleting, errorMsg, onComplete, onDelete } = useQuestActions(
  () => props.quest,
  { completed: (r) => emit('completed', r), deleted: (id) => emit('deleted', id) },
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <article class="flex items-start gap-3 rounded-none border border-line bg-[rgba(14,9,30,0.6)] px-[0.8rem] py-[0.6rem]">
      <span
        class="grid h-7 w-7 flex-none place-items-center rounded-none border bg-panel text-[0.9rem] font-extrabold [text-shadow:0_0_8px_currentColor]"
        :style="{ color, borderColor: color }"
      >
        {{ quest.difficulty }}
      </span>

      <div class="min-w-0 flex-auto">
        <h3 class="m-0 text-[0.95rem] text-ink-soft">
          <button
            v-if="openable"
            type="button"
            class="m-0 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit [font:inherit] hover:text-white hover:underline"
            @click="emit('open', quest, $event)"
          >
            {{ quest.title }}
          </button>
          <template v-else>{{ quest.title }}</template>
        </h3>
        <!-- Name only — the raw id is never shown; the line is hidden until the
             parent resolves a name. -->
        <div v-if="parentName" class="mt-[0.15rem] flex flex-wrap gap-3 text-[0.7rem] text-[#6a5da0]">
          <span>Sub-task of: {{ parentName }}</span>
        </div>
        <!-- Clamp long descriptions to 2 lines so one quest can't dominate the list;
             the full text lives in the detail view (QuestDetail). -->
        <p v-if="quest.description" class="mb-[0.3rem] mt-[0.2rem] line-clamp-2 text-[0.85rem] text-ink-muted">{{ quest.description }}</p>
        <div class="flex gap-3 text-[0.75rem] text-ink-muted">
          <span class="font-semibold text-accent-light">+{{ quest.xpReward }} XP</span>
          <span v-if="deadlineLabel">⌛ {{ deadlineLabel }}</span>
        </div>
        <p v-if="errorMsg" class="mt-[0.4rem] text-[0.75rem] text-danger-bright">{{ errorMsg }}</p>
      </div>

      <div class="flex flex-none gap-[0.4rem]">
        <button
          v-if="isActive"
          class="min-h-[44px] cursor-pointer rounded-none border border-line bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55] md:min-h-0"
          :disabled="completing || deleting"
          @click="emit('edit', quest, $event)"
        >
          Edit
        </button>
        <!-- Sub-tasks only expose Edit; Complete/Delete stay on the top-level quest. -->
        <button
          v-if="isActive && !isSubTask"
          class="min-h-[44px] cursor-pointer rounded-none border-0 bg-gradient-to-b from-accent-deep to-accent-dark px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-white enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55] md:min-h-0"
          :disabled="completing || deleting"
          @click="onComplete"
        >
          {{ completing ? '…' : 'Complete' }}
        </button>
        <button
          v-if="!isSubTask"
          class="min-h-[44px] min-w-[44px] cursor-pointer rounded-none border border-[#5a2740] bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger-bright enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55] md:min-h-0 md:min-w-0"
          :disabled="completing || deleting"
          @click="onDelete"
          aria-label="Delete quest"
        >
          {{ deleting ? '…' : '✕' }}
        </button>
      </div>
    </article>

    <!-- Nested sub-tasks: indented and dimmed slightly to read as children. -->
    <div v-if="quest.subTasks?.length" class="ml-5 flex flex-col gap-2 border-l border-line pl-3">
      <QuestCard
        v-for="st in quest.subTasks"
        :key="st.id"
        :quest="st"
        is-sub-task
        :parent-name="quest.title"
        @edit="(q, e) => emit('edit', q, e)"
      />
    </div>
  </div>
</template>
