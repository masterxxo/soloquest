<script setup lang="ts">
import { type Quest, type CompleteResult } from '~/lib/api-client';
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
  // Edit — bubbles to the page, which owns the edit modal.
  edit: [quest: Quest, event: MouseEvent];
}>();

const isActive = computed(() => props.quest.status === 'active');

const rankColor = computed(() => RANK_COLORS[props.quest.difficulty] ?? '#8a8f98');
const deadlineLabel = computed(() =>
  props.quest.deadline ? new Date(props.quest.deadline).toLocaleDateString() : null,
);
const createdLabel = computed(() => new Date(props.quest.createdAt).toLocaleDateString());
const subCount = computed(() => props.quest.subTasks?.length ?? 0);

const { completing, deleting, errorMsg, onComplete, onDelete } = useQuestActions(
  () => props.quest,
  { completed: (r) => emit('completed', r), deleted: (id) => emit('deleted', id) },
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Title row -->
    <header class="flex items-center gap-[0.85rem]">
      <span
        class="grid h-[2.4rem] w-[2.4rem] flex-none place-items-center border bg-panel text-[1.1rem] font-extrabold [text-shadow:0_0_8px_currentColor]"
        :style="{ color: rankColor, borderColor: rankColor }"
      >
        {{ quest.difficulty }}
      </span>
      <h2 class="m-0 text-[1.6rem] leading-[1.2] text-ink-soft">{{ quest.title }}</h2>
    </header>

    <!-- Two panes: wide main column + fixed details rail. Stacks on narrow widths. -->
    <div class="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-7 max-[720px]:grid-cols-[1fr]">
      <!-- Main column -->
      <main class="flex min-w-0 flex-col gap-6">
        <section class="flex flex-col gap-[0.6rem]">
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Description</h4>
          <p v-if="quest.description" class="m-0 whitespace-pre-wrap text-[0.95rem] leading-[1.6] text-ink">{{ quest.description }}</p>
          <p v-else class="m-0 text-[0.85rem] text-line-soft">No description.</p>
        </section>

        <section class="flex flex-col gap-[0.6rem]">
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Sub-quests <span class="ml-[0.35rem] border border-line bg-[#1a1238] px-[0.4rem] py-[0.05rem] text-[0.7rem] text-[#c9bcff]">{{ subCount }}</span></h4>
          <div v-if="subCount" class="flex flex-col gap-2">
            <QuestCard
              v-for="st in quest.subTasks"
              :key="st.id"
              :quest="st"
              is-sub-task
              :parent-name="quest.title"
              @edit="(q, e) => emit('edit', q, e)"
            />
          </div>
          <p v-else class="m-0 text-[0.85rem] text-line-soft">No sub-quests.</p>
        </section>
      </main>

      <!-- Details sidebar -->
      <aside class="flex flex-col gap-4 border border-line bg-[rgba(14,9,30,0.6)] p-4">
        <div class="flex flex-col gap-2">
          <button
            v-if="isActive"
            class="cursor-pointer border-0 bg-gradient-to-b from-accent-deep to-accent-dark px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-white shadow-[0_0_14px_rgba(124,92,232,0.45)] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
            :disabled="completing || deleting"
            @click="onComplete"
          >
            {{ completing ? '…' : 'Complete' }}
          </button>
          <button
            v-if="isActive"
            class="cursor-pointer border border-line bg-transparent px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-ink enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
            :disabled="completing || deleting"
            @click="emit('edit', quest, $event)"
          >
            Edit
          </button>
          <button
            class="cursor-pointer border border-[#5a2740] bg-transparent px-[0.7rem] py-[0.55rem] font-[inherit] text-[0.85rem] font-semibold text-danger-bright enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-[.55]"
            :disabled="completing || deleting"
            @click="onDelete"
          >
            {{ deleting ? '…' : 'Delete' }}
          </button>
        </div>
        <p v-if="errorMsg" class="m-0 text-[0.78rem] text-danger-bright">{{ errorMsg }}</p>

        <div>
          <h4 class="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-ink-muted">Details</h4>
          <dl class="mt-[0.6rem] grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <dt class="text-[0.78rem] text-ink-muted">Rank</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">
              <span
                class="inline-grid h-6 w-6 place-items-center border bg-panel text-[0.8rem] font-extrabold"
                :style="{ color: rankColor, borderColor: rankColor }"
              >
                {{ quest.difficulty }}
              </span>
            </dd>
            <dt class="text-[0.78rem] text-ink-muted">Status</dt>
            <dd class="m-0 text-right text-[0.85rem] capitalize text-ink">{{ quest.status }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">XP reward</dt>
            <dd class="m-0 text-right text-[0.85rem] font-semibold text-accent-light">+{{ quest.xpReward }} XP</dd>
            <dt class="text-[0.78rem] text-ink-muted">Deadline</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ deadlineLabel ?? '—' }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">Campaign</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ campaignName ?? '—' }}</dd>
            <dt class="text-[0.78rem] text-ink-muted">Created</dt>
            <dd class="m-0 text-right text-[0.85rem] text-ink">{{ createdLabel }}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </div>
</template>
