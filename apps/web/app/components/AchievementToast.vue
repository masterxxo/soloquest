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
    <div v-if="achievements && achievements.length" class="achv">
      <p class="achv-tag">[ ACHIEVEMENT ]</p>
      <div v-for="a in achievements" :key="a.id" class="achv-item">
        <p class="achv-title">🏆 {{ a.title }}</p>
        <p v-if="a.description" class="achv-desc">{{ a.description }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.achv {
  position: fixed;
  /* Sits below the level-up / rank-warning toasts (top: 1.5rem) so they can stack. */
  top: 6rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  padding: 1rem 2rem;
  text-align: center;
  background: rgba(8, 5, 20, 0.95);
  border: 1px solid #e8c468;
  box-shadow: 0 0 30px rgba(232, 196, 104, 0.6), inset 0 0 18px rgba(232, 196, 104, 0.22);
  backdrop-filter: blur(6px);
}
.achv-tag { margin: 0 0 0.4rem; letter-spacing: 0.3em; font-size: 0.65rem; color: #e8c468; }
.achv-item { margin: 0.35rem 0; }
.achv-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #f6e6b0;
  text-shadow: 0 0 12px rgba(232, 196, 104, 0.75);
}
.achv-desc { margin: 0.1rem 0 0; font-size: 0.78rem; color: #c9b87f; }
.achv-enter-active, .achv-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.achv-enter-from, .achv-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
