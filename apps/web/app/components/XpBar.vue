<script setup lang="ts">
// Shared XP progress bar — used by the top bar and the Status panel.
defineProps<{ percent: number }>();
</script>

<template>
  <div
    class="h-[10px] overflow-hidden border border-accent/55 bg-accent/12 shadow-[inset_0_0_6px_rgba(124,92,232,0.2),0_0_5px_rgba(124,92,232,0.3)]"
  >
    <!-- Tinted track + glowing outline so the bar reads as a defined element even
         when empty (a near-black track vanished against the dark header). -->
    <div
      class="h-full bg-gradient-to-r from-[#5a3fd0] to-accent-light shadow-[0_0_10px_rgba(124,92,232,0.8)] transition-[width] duration-[400ms] ease-[ease]"
      :style="{ width: `${percent}%` }"
    />
  </div>
</template>
