<script setup lang="ts">
// Inline-SVG nav glyphs for the grimoire tabs. Kept as inline SVG (not an icon font)
// to match the rest of the app and avoid a new dependency. `currentColor` so each
// glyph inherits the tab's text colour (active / hover / soon states).
defineProps<{ name: string }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Quests — scroll / task list -->
    <template v-if="name === 'quests'">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="8.5" y1="8" x2="15.5" y2="8" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
      <line x1="8.5" y1="16" x2="13" y2="16" />
    </template>

    <!-- Rituals — flame -->
    <template v-else-if="name === 'rituals'">
      <path d="M12 3c.6 3-1.8 4.2-2.8 6.2A5 5 0 0 0 17 12c0-3-2-4.2-2-7-1.2.8-2 2-3 4-.6-2 0-4 0-6z" />
    </template>

    <!-- Status — bust in a ring -->
    <template v-else-if="name === 'status'">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18.5c1-2.2 3-3.3 5.5-3.3s4.5 1.1 5.5 3.3" />
    </template>

    <!-- Glossary — open book -->
    <template v-else-if="name === 'glossary'">
      <path d="M12 6c-1.5-1.2-3.5-1.8-6-1.8V18c2.5 0 4.5.6 6 1.8" />
      <path d="M12 6c1.5-1.2 3.5-1.8 6-1.8V18c-2.5 0-4.5.6-6 1.8" />
      <line x1="12" y1="6" x2="12" y2="19.8" />
    </template>

    <!-- Items — pack -->
    <template v-else-if="name === 'items'">
      <path d="M6 9V7a3 3 0 0 1 6 0 3 3 0 0 1 6 0v2" />
      <path d="M5 9h14l-1 11H6L5 9z" />
      <line x1="9.5" y1="13" x2="14.5" y2="13" />
    </template>
  </svg>
</template>
