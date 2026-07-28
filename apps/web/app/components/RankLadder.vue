<script setup lang="ts">
import { DIFFICULTY_ORDER } from '@soloquest/shared';
import { usePlayerStore } from '~/stores/player';

// The E→S rank ladder on Status. NEEDS DOMAIN: the real level thresholds per band are not
// decided, so every range below is a PLACEHOLDER (rendered with a dashed underline) shown only
// to prove the layout. The "current" band comes from the store's existing cosmetic rank getter
// — this component does not introduce a new rankFromLevel from these mock numbers.
const player = usePlayerStore();

// Placeholder ranges — kept in step with the store's cosmetic rankForLevel so the highlighted
// band matches player.rank, but not a committed mechanic.
const PLACEHOLDER_RANGE: Record<string, string> = {
  E: 'LV 1–4',
  D: 'LV 5–9',
  C: 'LV 10–19',
  B: 'LV 20–34',
  A: 'LV 35–49',
  S: 'LV 50+',
};

const currentIndex = computed(() => DIFFICULTY_ORDER.indexOf(player.rank as (typeof DIFFICULTY_ORDER)[number]));
const nextRank = computed(() => DIFFICULTY_ORDER[currentIndex.value + 1] ?? null);

function state(i: number): 'passed' | 'current' | 'locked' {
  if (i < currentIndex.value) return 'passed';
  if (i === currentIndex.value) return 'current';
  return 'locked';
}
</script>

<template>
  <section class="corner-cut flex flex-col gap-3 border border-dl-grid-line bg-dl-surface p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Rank ladder · derived from level</span>
      <span class="border border-dl-gold bg-dl-gold/10 px-2 py-0.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink">Example thresholds</span>
    </div>

    <p class="m-0 flex gap-2 border border-dl-gold bg-dl-gold/10 px-3 py-2 text-dl-meta text-dl-ink">
      <span aria-hidden="true" class="text-dl-gold">!</span>
      Needs domain confirmation. The level thresholds per band are not decided — every value below is a placeholder shown to prove the layout, not a rule to implement.
    </p>

    <div class="flex flex-wrap gap-2">
      <div v-for="(rank, i) in DIFFICULTY_ORDER" :key="rank" class="flex flex-1 flex-col items-center gap-1.5">
        <div
          class="flex w-full flex-col items-center gap-1.5 border p-2"
          :class="state(i) === 'current' ? 'border-dl-violet bg-dl-violet-wash' : 'border-dl-hairline bg-dl-surface'"
        >
          <RankBadge :rank="rank" />
          <span class="font-dl-mono text-[0.6rem] uppercase tracking-wide text-dl-ink-muted underline decoration-dashed underline-offset-2">{{ PLACEHOLDER_RANGE[rank] }}</span>
        </div>
        <span
          class="font-dl-mono text-[0.6rem] uppercase tracking-wide"
          :class="state(i) === 'current' ? 'text-dl-violet' : state(i) === 'passed' ? 'text-dl-ink-faint' : 'text-dl-ink-faint'"
        >{{ state(i) }}</span>
      </div>
    </div>

    <p class="m-0 font-dl-mono text-dl-label text-dl-ink-muted">
      level {{ player.level }} · rank {{ player.rank }} ·
      <span v-if="nextRank">next: rank {{ nextRank }} at level <span class="underline decoration-dashed underline-offset-2">XX</span></span>
      <span v-else>top rank reached</span>
    </p>
  </section>
</template>
