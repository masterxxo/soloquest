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
  background: #0a0618;
  border: 1px solid #2a2050;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, #5a3fd0, #9c7cff);
  box-shadow: 0 0 10px rgba(124, 92, 232, 0.8);
  transition: width 0.4s ease;
}
</style>
