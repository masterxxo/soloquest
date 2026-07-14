<script setup lang="ts">
import { type Achievement } from '~/lib/api-client';

// "System"-style achievement feedback. Shown while `achievements` is a non-empty list;
// the parent owns the auto-hide timer, and the layout's toast container owns the position
// (a completion can level you up, warn about rank *and* unlock an achievement — the
// container stacks whatever shows up). Gold styling, a warmer shade (#e8c468) than the
// warning notice (#f0b429).
defineProps<{ achievements: Achievement[] | null }>();
</script>

<template>
  <Transition name="achv">
    <div
      v-if="achievements && achievements.length"
      class="pointer-events-auto max-w-full shrink-0 border border-[#e8c468] bg-[rgba(8,5,20,0.95)] px-8 py-4 text-center shadow-[0_0_30px_rgba(232,196,104,0.6),inset_0_0_18px_rgba(232,196,104,0.22)] backdrop-blur-[6px]"
      role="status"
      aria-live="polite"
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
/* Vue transition classes (<Transition name="achv">) — Nuxt/Vue attaches them
   dynamically, so they can't be expressed as utilities; kept as CSS. */
.achv-enter-active, .achv-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.achv-enter-from, .achv-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
