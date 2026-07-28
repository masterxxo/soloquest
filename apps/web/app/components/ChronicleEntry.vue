<script setup lang="ts">
import type { CompletionLogEntry } from '~/lib/api-client';

// One read-only line in the Chronicles log: title + rank + XP + time, from the completion's
// snapshot (the quest may be gone). No tags or priority — they aren't in the completion
// snapshot. Cyan appears only as a fill marker, never as the XP numeral (Chronicles ruling).
const props = defineProps<{ entry: CompletionLogEntry }>();

const time = computed(() =>
  new Date(props.entry.completedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
);
</script>

<template>
  <article class="flex items-center gap-3 border border-dl-hairline bg-dl-surface px-3 py-2">
    <span class="min-w-0 flex-1 truncate text-dl-body text-dl-ink">{{ entry.title }}</span>
    <RankBadge :rank="entry.difficulty" class="shrink-0" />
    <span class="flex shrink-0 items-center gap-1.5 font-dl-mono text-dl-label text-dl-ink">
      <span class="h-2 w-2 bg-dl-cyan" aria-hidden="true" />+{{ entry.xpAwarded }} XP
    </span>
    <span class="w-12 shrink-0 text-right font-dl-mono text-dl-label text-dl-ink-faint">{{ time }}</span>
  </article>
</template>
