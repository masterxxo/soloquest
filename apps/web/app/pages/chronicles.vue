<script setup lang="ts">
import { DIFFICULTY_ORDER } from '@soloquest/shared';
import {
  client,
  type CompletionSummary,
  type CompletionLogEntry,
} from '~/lib/api-client';
import { rankColor } from '~/lib/ranks';
import { groupByCompletionDate } from '~/lib/date';

// NOTE: "Chronicles" is purely the UI name for the quest-completion history. The API, DB
// tables and shared types keep the `quest-completions` vocabulary — this is presentation only.

// The log is paginated (keyset), so its rows live in a local ref we append to on "Load more";
// the summary is a single shot. Both are fetched client-side, like the rest of the app.
const entries = ref<CompletionLogEntry[]>([]);
const nextCursor = ref<string | null>(null);

const { data: summary, pending, error } = useAsyncData<CompletionSummary>(
  'chronicle',
  async () => {
    const [summaryRes, logRes] = await Promise.all([
      client.api.quests.completions.summary.$get(),
      client.api.quests.completions.$get({ query: {} }),
    ]);
    if (!summaryRes.ok || !logRes.ok) throw new Error('Failed to load chronicles');
    const log = await logRes.json();
    entries.value = log.items;
    nextCursor.value = log.nextCursor;
    return summaryRes.json();
  },
  { server: false },
);

const loadingMore = ref(false);
async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const res = await client.api.quests.completions.$get({
      query: { cursor: nextCursor.value },
    });
    if (res.ok) {
      const log = await res.json();
      entries.value.push(...log.items);
      nextCursor.value = log.nextCursor;
    }
  } finally {
    loadingMore.value = false;
  }
}

// Per-rank tiles in canonical E→S order, coloured by the shared rank palette.
const rankBreakdown = computed(() =>
  DIFFICULTY_ORDER.map((rank) => ({
    rank,
    count: summary.value?.byRank[rank] ?? 0,
    color: rankColor(rank),
  })),
);

// Relative day groups (Today / Yesterday / This week / by month) over the safe backend dates.
const groups = computed(() => groupByCompletionDate(entries.value));

const isEmpty = computed(() => !pending.value && !error.value && entries.value.length === 0);
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex items-center justify-between gap-4">
      <h1 class="m-0 text-[1.1rem] font-bold uppercase tracking-[0.1em] text-ink-bright">Chronicles</h1>
    </header>

    <!-- Stats, chart and log are all ordinary in-flow content: the whole page scrolls as one
         inside the layout's content section (default.vue). No nested scroll region — on
         mobile and desktop you scroll past the stats and chart, then the log, then "Load more". -->
    <div class="flex flex-col gap-5">
      <p v-if="pending" class="m-0 text-[0.85rem] text-line-soft">Reading the chronicle…</p>
      <p v-else-if="error" class="m-0 text-[0.85rem] text-danger-bright">
        Couldn't load your chronicle. Try again in a moment.
      </p>

      <template v-else-if="summary">
        <!-- Stat cards: total completed, total XP, per-rank breakdown. -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="flex flex-col gap-[0.2rem] rounded-[8px] border border-line bg-[rgba(26,17,64,0.6)] p-[0.85rem] text-center">
            <span class="text-[1.5rem] font-bold text-ink">{{ summary.totalCompleted }}</span>
            <span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Completed</span>
          </div>
          <div class="flex flex-col gap-[0.2rem] rounded-[8px] border border-line bg-[rgba(26,17,64,0.6)] p-[0.85rem] text-center">
            <span class="text-[1.5rem] font-bold text-accent-soft">{{ summary.totalXp }}</span>
            <span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Total XP</span>
          </div>
          <!-- Rank breakdown spans the remaining two columns: six small rank badges + counts. -->
          <div class="col-span-2 flex items-center justify-around gap-1 rounded-[8px] border border-line bg-[rgba(26,17,64,0.6)] p-[0.85rem]">
            <div v-for="r in rankBreakdown" :key="r.rank" class="flex flex-col items-center gap-[0.3rem]">
              <span
                class="grid h-6 w-6 place-items-center rounded-none border bg-panel text-[0.8rem] font-extrabold [text-shadow:0_0_8px_currentColor]"
                :style="{ color: r.color, borderColor: r.color }"
              >
                {{ r.rank }}
              </span>
              <span class="text-[0.8rem] font-semibold text-ink-soft">{{ r.count }}</span>
            </div>
          </div>
        </div>

        <ChronicleXpChart :timeline="summary.timeline" />

        <!-- Log — plain flow, scrolled together with the stats and chart above it. -->
        <div class="flex flex-col gap-4">
          <p v-if="isEmpty" class="m-0 text-[0.85rem] text-line-soft">
            Your chronicle is empty — complete a quest to begin.
          </p>

          <section v-for="group in groups" :key="group.key" class="flex flex-col gap-2">
            <div class="border-b border-line-soft/30 pb-[0.4rem] text-[0.7rem] uppercase tracking-[0.18em] text-line-soft">
              {{ group.label }}
            </div>
            <div class="flex flex-col gap-2">
              <ChronicleEntry v-for="entry in group.items" :key="entry.id" :entry="entry" />
            </div>
          </section>

          <button
            v-if="nextCursor"
            type="button"
            class="mx-auto mt-1 cursor-pointer border border-line bg-transparent px-[0.9rem] py-[0.45rem] text-[0.8rem] font-semibold text-ink font-[inherit] transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
