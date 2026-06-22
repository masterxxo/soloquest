<script setup lang="ts">
// "System"-style rank warning feedback. Shown while there are warnings; the parent
// owns the auto-hide timer. Amber/warning styling to set it apart from the level-up toast.
defineProps<{ warnings: string[] }>();
</script>

<template>
  <Transition name="rankwarn">
    <div v-if="warnings.length" class="rankwarn">
      <p class="rankwarn-tag">[ SYSTEM ]</p>
      <p v-for="(w, i) in warnings" :key="i" class="rankwarn-line">⚠ {{ w }}</p>
    </div>
  </Transition>
</template>

<style scoped>
.rankwarn {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  padding: 1rem 2rem;
  text-align: center;
  background: rgba(8, 5, 20, 0.95);
  border: 1px solid #f0b429;
  box-shadow: 0 0 30px rgba(240, 180, 41, 0.55), inset 0 0 18px rgba(240, 180, 41, 0.2);
  backdrop-filter: blur(6px);
}
.rankwarn-tag { margin: 0 0 0.35rem; letter-spacing: 0.3em; font-size: 0.65rem; color: #f0b429; }
.rankwarn-line {
  margin: 0.15rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #f7d774;
  text-shadow: 0 0 10px rgba(240, 180, 41, 0.6);
}
.rankwarn-enter-active, .rankwarn-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.rankwarn-enter-from, .rankwarn-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
