<script setup lang="ts">
import { type Achievement } from '~/lib/api-client';

// "System"-style achievement feedback. Shown while `achievements` is a non-empty list;
// the parent owns the auto-hide timer. Gold styling — a warmer shade (#e8c468) than the
// rank-warning toast (#f0b429) and offset lower than the level-up toast so the two can
// appear together (a completion can both level you up and unlock an achievement).
defineProps<{ achievements: Achievement[] | null }>();
</script>

<template>
  <Transition name="achv">
    <!-- top-24 (6rem) sadza toast poniżej level-up / rank-warning (top-6), by mogły się układać. -->
    <div
      v-if="achievements && achievements.length"
      class="fixed left-1/2 top-24 z-[60] -translate-x-1/2 border border-[#e8c468] bg-[rgba(8,5,20,0.95)] px-8 py-4 text-center shadow-[0_0_30px_rgba(232,196,104,0.6),inset_0_0_18px_rgba(232,196,104,0.22)] backdrop-blur-[6px]"
    >
      <p class="mb-[0.4rem] text-[0.65rem] tracking-[0.3em] text-[#e8c468]">[ ACHIEVEMENT ]</p>
      <div v-for="a in achievements" :key="a.id" class="my-[0.35rem]">
        <p class="m-0 text-[1rem] font-extrabold text-[#f6e6b0] [text-shadow:0_0_12px_rgba(232,196,104,0.75)]">🏆 {{ a.title }}</p>
        <p v-if="a.description" class="mt-[0.1rem] text-[0.78rem] text-[#c9b87f]">{{ a.description }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Klasy przejścia Vue (<Transition name="achv">) — Nuxt/Vue dokleja je
   dynamicznie, więc nie da się ich wyrazić w utility; zostają jako CSS. */
.achv-enter-active, .achv-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.achv-enter-from, .achv-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
