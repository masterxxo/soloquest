<script setup lang="ts">
// Canonical rank badge — Design System Board v1.3 (rank section). Single source of truth for
// the rank pill reused across screens (the control page consumes it; step 3's Quests migration
// will too). The colour law: for E–A the rank colour lives in the tint fill (10%), the 1px
// border (full colour) and never in the letter — the letter is ALWAYS ink (#14111F). S is the
// sole exception: inverted, solid ink fill with a white letter.
const props = defineProps<{ rank: string }>();

// A closed set of 6 ranks, so the colour classes are written as complete static strings and
// Tailwind's JIT sees each literal. (A computed `bg-dl-rank-${x}` would be purged — same reason
// tag colours use a lookup, except here the set is fixed so classes beat runtime :style.)
// `/10` is the 10% tint of the hex rank colour; `border-dl-rank-*` is the full colour.
const RANK_CLASS: Record<string, string> = {
  E: 'bg-dl-rank-e/10 border-dl-rank-e text-dl-ink',
  D: 'bg-dl-rank-d/10 border-dl-rank-d text-dl-ink',
  C: 'bg-dl-rank-c/10 border-dl-rank-c text-dl-ink',
  B: 'bg-dl-rank-b/10 border-dl-rank-b text-dl-ink',
  A: 'bg-dl-rank-a/10 border-dl-rank-a text-dl-ink',
  S: 'bg-dl-rank-s border-dl-rank-s text-dl-rank-s-ink',
};

const letter = computed(() => props.rank.toUpperCase());
const cls = computed(() => RANK_CLASS[letter.value] ?? RANK_CLASS.E);
</script>

<template>
  <span
    class="corner-cut-sm inline-flex h-9 w-9 items-center justify-center border font-dl-display text-dl-body font-semibold"
    :class="cls"
  >{{ letter }}</span>
</template>
