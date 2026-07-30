<script setup lang="ts">
import { useReducedMotion } from '~/composables/useReducedMotion';

// A digit-by-digit odometer for a running integer (the telemetry XP counter). It inherits its
// colour from the surrounding text — deliberately ink, never cyan (cyan is the XP-bar fill only).
// Under reduced motion it drops the roll and renders the value flat, so the change is an instant,
// fully readable jump rather than a faster tween.
const props = defineProps<{ value: number }>();
const { reduced } = useReducedMotion();

const digits = computed(() => Math.trunc(props.value).toString().split(''));
</script>

<template>
  <span v-if="reduced" class="tabular-nums">{{ Math.trunc(value) }}</span>
  <span v-else class="dl-roll tabular-nums" :aria-label="String(Math.trunc(value))">
    <!-- Keyed from the right so the low-order digits keep their identity (and animate) as the
         number grows a place; a new high-order column simply mounts. -->
    <span v-for="(d, i) in digits" :key="digits.length - i" class="dl-roll-col" aria-hidden="true">
      <span class="dl-roll-strip" :style="{ transform: `translateY(-${Number(d)}em)` }">
        <span v-for="n in 10" :key="n" class="dl-roll-cell">{{ n - 1 }}</span>
      </span>
    </span>
  </span>
</template>
