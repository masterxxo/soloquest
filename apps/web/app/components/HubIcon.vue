<script setup lang="ts">
// A hub action button positioned by percentage over the character screen.
// The icon glyph is passed in via the default slot (an inline <svg>).
withDefaults(
  defineProps<{ label: string; x: string; y: string; disabled?: boolean }>(),
  { disabled: false },
);
const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <button
    class="hub-icon"
    :class="{ 'hub-icon--disabled': disabled }"
    :style="{ left: x, top: y }"
    type="button"
    :disabled="disabled"
    @click="emit('select')"
  >
    <span class="hub-box"><slot /></span>
    <span class="hub-label">{{ label }}</span>
  </button>
</template>

<style scoped>
.hub-icon {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}
.hub-box {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  background: rgba(8, 5, 20, 0.85);
  border: 1px solid rgba(80, 50, 160, 0.4);
  backdrop-filter: blur(8px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.hub-box :deep(svg) { width: 30px; height: 30px; }
.hub-icon:hover .hub-box {
  border-color: #7c5ce8;
  box-shadow: 0 0 16px rgba(124, 92, 232, 0.5);
}
.hub-label {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8174b8;
}
.hub-icon--disabled {
  opacity: 0.35;
  pointer-events: none;
}
</style>
