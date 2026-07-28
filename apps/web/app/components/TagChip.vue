<script setup lang="ts">
import type { TagColor } from '@soloquest/shared';
import { tagChipStyle } from '~/lib/tag-colors';

// The shared Daylight tag chip — the single visual for a pinned/selected tag across the app
// (quest row, filter selection, and the step-3b surfaces). Colour comes ONLY from
// `tagChipStyle` (10% tint fill + full-colour border + ink label); the chip never writes a
// hex. `removable` adds an ✕ that emits `remove`. Corner-cut is the shared form language.
defineProps<{ name: string; color: TagColor; removable?: boolean }>();
const emit = defineEmits<{ remove: [] }>();
</script>

<template>
  <span
    class="corner-cut-sm inline-flex max-w-[10rem] items-center gap-1 border px-1.5 py-0.5 text-dl-label leading-none"
    :style="tagChipStyle(color)"
  >
    <span class="truncate">{{ name }}</span>
    <button
      v-if="removable"
      type="button"
      class="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-current leading-none opacity-70 hover:opacity-100"
      :aria-label="`Remove tag ${name}`"
      @click.stop="emit('remove')"
    >
      ✕
    </button>
  </span>
</template>
