<script setup lang="ts">
import { DIFFICULTY_ORDER } from '@soloquest/shared';
import { client, type CompletionSummary, type CompletionLogEntry } from '~/lib/api-client';
import { groupByCompletionDate } from '~/lib/date';

// NOTE: "Chronicles" is purely the UI name for the quest-completion history. The API, DB
// tables and shared types keep the `quest-completions` vocabulary — this is presentation only.
// Completed QUESTS only; ritual completions are recorded separately and never appear here.
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
    const res = await client.api.quests.completions.$get({ query: { cursor: nextCursor.value } });
    if (res.ok) {
      const log = await res.json();
      entries.value.push(...log.items);
      nextCursor.value = log.nextCursor;
    }
  } finally {
    loadingMore.value = false;
  }
}

// Per-rank distribution, E→S, with a share of the all-time total.
const rankBreakdown = computed(() => {
  const total = summary.value?.totalCompleted ?? 0;
  return DIFFICULTY_ORDER.map((rank) => {
    const count = summary.value?.byRank[rank] ?? 0;
    return { rank, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  });
});

const groups = computed(() => groupByCompletionDate(entries.value));
const isEmpty = computed(() => !pending.value && !error.value && entries.value.length === 0);
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Read-only banner -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dl-band-line pb-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">
      <span class="text-dl-ink">Chronicles</span>
      <span>Completed quests only</span>
      <span class="text-dl-ink-faint normal-case">Rituals are recorded separately and never appear here.</span>
      <span class="ml-auto">Read-only</span>
    </div>

    <p v-if="pending" class="m-0 text-dl-body text-dl-ink-muted">Reading the chronicle…</p>
    <p v-else-if="error" class="m-0 text-dl-body text-dl-magenta">Couldn't load your chronicle. Try again in a moment.</p>

    <template v-else-if="summary">
      <!-- Stat cards -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="corner-cut flex flex-col gap-1 border border-dl-grid-line bg-dl-surface p-4">
          <span class="font-dl-display text-dl-numeral font-semibold text-dl-ink">{{ summary.totalCompleted.toLocaleString() }}</span>
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Quests completed</span>
        </div>
        <div class="corner-cut flex flex-col gap-1 border border-dl-grid-line bg-dl-surface p-4">
          <span class="font-dl-display text-dl-numeral font-semibold text-dl-ink">{{ summary.totalXp.toLocaleString() }}</span>
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">XP from quests · excludes ritual XP</span>
        </div>
      </div>

      <!-- Quests by rank -->
      <div class="corner-cut flex flex-col gap-3 border border-dl-grid-line bg-dl-surface p-4">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Quests by rank · difficulty at completion</span>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div v-for="r in rankBreakdown" :key="r.rank" class="flex items-center gap-2">
            <RankBadge :rank="r.rank" />
            <div class="flex flex-col leading-none">
              <span class="font-dl-display text-dl-title font-semibold text-dl-ink">{{ r.count.toLocaleString() }}</span>
              <span class="mt-0.5 font-dl-mono text-dl-label text-dl-ink-faint">{{ r.pct }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="corner-cut border border-dl-grid-line bg-dl-surface p-4">
        <ChronicleXpChart :timeline="summary.timeline" />
      </div>

      <!-- Log -->
      <div class="flex flex-col gap-4">
        <!-- Empty state: the chart's own baseline — seven empty days, no bars. -->
        <div v-if="isEmpty" class="corner-cut mx-auto flex max-w-md flex-col items-center gap-3 border border-dl-grid-line bg-dl-surface px-6 py-12 text-center">
          <span class="flex gap-1.5" aria-hidden="true">
            <span v-for="i in 7" :key="i" class="h-3 w-6 border-b border-dashed border-dl-grid-line" />
          </span>
          <h2 class="m-0 font-dl-display text-dl-title font-semibold uppercase tracking-wide text-dl-ink">No quests completed yet</h2>
          <p class="m-0 text-dl-body text-dl-ink-muted">Chronicles records finished quests — the title, its rank and the XP it paid, kept exactly as they were at the moment you completed it.</p>
          <p class="m-0 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-faint">Ritual completions are kept separately</p>
        </div>

        <section v-for="group in groups" :key="group.key" class="flex flex-col gap-1.5">
          <div class="border-b border-dl-band-line pb-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">{{ group.label }}</div>
          <div class="flex flex-col gap-1">
            <ChronicleEntry v-for="entry in group.items" :key="entry.id" :entry="entry" />
          </div>
        </section>

        <button
          v-if="nextCursor"
          type="button"
          class="dl-focus-inset mx-auto mt-1 cursor-pointer border border-dl-grid-line bg-dl-surface px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted transition-colors hover:bg-dl-sunk hover:text-dl-ink disabled:opacity-60"
          :disabled="loadingMore"
          @click="loadMore"
        >{{ loadingMore ? 'Loading…' : 'Load 30 older' }}</button>
      </div>
    </template>
  </div>
</template>
