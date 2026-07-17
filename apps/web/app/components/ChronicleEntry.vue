<script setup lang="ts">
import type { CompletionLogEntry } from '~/lib/api-client';
import { rankColor } from '~/lib/ranks';

// A single, read-only line in the Chronicles log. Deliberately NOT a QuestCard: this is a
// register of things already done, so it carries no Edit / Complete / Delete action and no
// click-through. Title/difficulty/xp are the completion's snapshot (the quest may be gone).
const props = defineProps<{ entry: CompletionLogEntry }>();

const color = computed(() => rankColor(props.entry.difficulty));

// Time-of-day of the completion, in the viewer's locale. The day itself is already the
// group header, so the row only needs the clock time.
const time = computed(() =>
  new Date(props.entry.completedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }),
);
</script>

<template>
  <article
    class="flex items-center gap-3 rounded-none border border-line bg-[rgba(14,9,30,0.6)] px-[0.8rem] py-[0.55rem]"
  >
    <span
      class="grid h-7 w-7 flex-none place-items-center rounded-none border bg-panel text-[0.9rem] font-extrabold [text-shadow:0_0_8px_currentColor]"
      :style="{ color, borderColor: color }"
    >
      {{ entry.difficulty }}
    </span>

    <h3 class="m-0 min-w-0 flex-auto truncate text-[0.95rem] text-ink-soft">
      {{ entry.title }}
    </h3>

    <div class="flex flex-none flex-col items-end gap-[0.15rem]">
      <span class="text-[0.8rem] font-semibold text-accent-light">+{{ entry.xpAwarded }} XP</span>
      <span class="text-[0.7rem] text-ink-dim">{{ time }}</span>
    </div>
  </article>
</template>
