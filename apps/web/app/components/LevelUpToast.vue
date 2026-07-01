<script setup lang="ts">
// "System"-style level-up feedback. Shown while `level` is non-null; the parent
// owns the auto-hide timer.
defineProps<{ level: number | null }>();
</script>

<template>
  <Transition name="levelup">
    <div
      v-if="level !== null"
      class="fixed left-1/2 top-6 z-[60] -translate-x-1/2 border border-accent bg-[rgba(8,5,20,0.95)] px-8 py-4 text-center shadow-[0_0_30px_rgba(124,92,232,0.7),inset_0_0_18px_rgba(124,92,232,0.25)] backdrop-blur-[6px]"
    >
      <p class="m-0 text-[0.65rem] tracking-[0.3em] text-accent">[ SYSTEM ]</p>
      <p class="my-[0.2rem] text-[1.6rem] font-extrabold text-[#eae4ff] [text-shadow:0_0_14px_rgba(124,92,232,0.9)]">LEVEL UP</p>
      <p class="m-0 text-[0.8rem] text-[#9b8fd6]">You reached LEVEL {{ level }}</p>
    </div>
  </Transition>
</template>

<style scoped>
/* Klasy przejścia Vue (<Transition name="levelup">) — Nuxt/Vue dokleja je
   dynamicznie, więc nie da się ich wyrazić w utility; zostają jako CSS. */
.levelup-enter-active, .levelup-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.levelup-enter-from, .levelup-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
