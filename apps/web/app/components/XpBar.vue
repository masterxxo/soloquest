<script setup lang="ts">
// Shared XP progress bar — used by the top bar and the Status panel.
defineProps<{ percent: number }>();
</script>

<template>
  <div class="bar">
    <div class="fill" :style="{ width: `${percent}%` }" />
  </div>
</template>

<style scoped>
.bar {
  height: 10px;
  /* Tinted track + glowing outline so the bar reads as a defined element even
     when empty (a near-black track vanished against the dark header). */
  background: rgba(124, 92, 232, 0.12);
  border: 1px solid rgba(124, 92, 232, 0.55);
  box-shadow: inset 0 0 6px rgba(124, 92, 232, 0.2), 0 0 5px rgba(124, 92, 232, 0.3);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, #5a3fd0, #9c7cff);
  box-shadow: 0 0 10px rgba(124, 92, 232, 0.8);
  transition: width 0.4s ease;
}
</style>
