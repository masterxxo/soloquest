<script setup lang="ts">
// Shared XP progress bar (Status profile). Cyan fill on a sunk track — cyan is fill only,
// never a numeral, per the system's colour law.
defineProps<{ percent: number }>();
</script>

<template>
  <div class="h-2 overflow-hidden bg-dl-sunk">
    <div
      class="h-full bg-dl-cyan transition-[width] duration-dl-sweep ease-dl"
      :style="{ width: `${percent}%` }"
    />
  </div>
</template>
