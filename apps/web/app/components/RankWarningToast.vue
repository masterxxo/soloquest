<script setup lang="ts">
// "System"-style rank warning feedback. Shown while there are warnings; the parent
// owns the auto-hide timer. Amber/warning styling to set it apart from the level-up toast.
defineProps<{ warnings: string[] }>();
</script>

<template>
  <Transition name="rankwarn">
    <div
      v-if="warnings.length"
      class="fixed left-1/2 top-6 z-[60] -translate-x-1/2 border border-gold bg-[rgba(8,5,20,0.95)] px-8 py-4 text-center shadow-[0_0_30px_rgba(240,180,41,0.55),inset_0_0_18px_rgba(240,180,41,0.2)] backdrop-blur-[6px]"
    >
      <p class="mb-[0.35rem] text-[0.65rem] tracking-[0.3em] text-gold">[ SYSTEM ]</p>
      <p
        v-for="(w, i) in warnings"
        :key="i"
        class="my-[0.15rem] text-[0.85rem] font-semibold text-[#f7d774] [text-shadow:0_0_10px_rgba(240,180,41,0.6)]"
      >
        ⚠ {{ w }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
/* Vue transition classes (<Transition name="rankwarn">) — Nuxt/Vue attaches them
   dynamically, so they can't be expressed as utilities; kept as CSS. */
.rankwarn-enter-active, .rankwarn-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.rankwarn-enter-from, .rankwarn-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
