<script setup lang="ts">
// Daylight shell navigation glyphs (desktop gutter + mobile bottom bar). Each icon is a bare
// geometric primitive (line / rect / circle / polygon) drawn inline — deliberately NOT an
// illustrative pictogram and with NO icon-library dependency. `currentColor` + fill:none so
// the tab's state drives the colour via CSS (active = violet, disabled = faint).
defineProps<{ name: string }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Quests — rhombus (square rotated 45°), outline only -->
    <template v-if="name === 'quests'">
      <polygon points="12 3, 21 12, 12 21, 3 12" />
    </template>

    <!-- Rituals — circle, outline only -->
    <template v-else-if="name === 'rituals'">
      <circle cx="12" cy="12" r="8.5" />
    </template>

    <!-- Chronicles — three parallel horizontal lines -->
    <template v-else-if="name === 'chronicles'">
      <line x1="5" y1="8" x2="19" y2="8" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="16" x2="19" y2="16" />
    </template>

    <!-- Status — triangle, apex up, outline only -->
    <template v-else-if="name === 'status'">
      <polygon points="12 3, 21 19, 3 19" />
    </template>

    <!-- Glossary — square, outline only (disabled stub) -->
    <template v-else-if="name === 'glossary'">
      <rect x="5" y="5" width="14" height="14" />
    </template>

    <!-- Items — square with one horizontal line below the top edge (a lid) (disabled stub) -->
    <template v-else-if="name === 'items'">
      <rect x="5" y="5" width="14" height="14" />
      <line x1="5" y1="9" x2="19" y2="9" />
    </template>

    <!-- Sign out — open box + arrow leaving to the right (line + polyline primitives) -->
    <template v-else-if="name === 'signout'">
      <polyline points="13 4, 5 4, 5 20, 13 20" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <polyline points="17 8, 21 12, 17 16" />
    </template>
  </svg>
</template>
