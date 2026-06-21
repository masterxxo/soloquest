<script setup lang="ts">
// "System"-style level-up feedback. Shown while `level` is non-null; the parent
// owns the auto-hide timer.
defineProps<{ level: number | null }>();
</script>

<template>
  <Transition name="levelup">
    <div v-if="level !== null" class="levelup">
      <p class="levelup-tag">[ SYSTEM ]</p>
      <p class="levelup-main">LEVEL UP</p>
      <p class="levelup-sub">You reached LEVEL {{ level }}</p>
    </div>
  </Transition>
</template>

<style scoped>
.levelup {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  padding: 1rem 2rem;
  text-align: center;
  background: rgba(8, 5, 20, 0.95);
  border: 1px solid #7c5ce8;
  box-shadow: 0 0 30px rgba(124, 92, 232, 0.7), inset 0 0 18px rgba(124, 92, 232, 0.25);
  backdrop-filter: blur(6px);
}
.levelup-tag { margin: 0; letter-spacing: 0.3em; font-size: 0.65rem; color: #7c5ce8; }
.levelup-main { margin: 0.2rem 0; font-size: 1.6rem; font-weight: 800; color: #eae4ff; text-shadow: 0 0 14px rgba(124, 92, 232, 0.9); }
.levelup-sub { margin: 0; font-size: 0.8rem; color: #9b8fd6; }
.levelup-enter-active, .levelup-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.levelup-enter-from, .levelup-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
