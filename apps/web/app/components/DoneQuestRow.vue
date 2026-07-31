<script setup lang="ts">
import type { Quest } from '~/lib/api-client';
import { priorityMarker, PRIORITY_DL_CLASS } from '~/lib/priority';

// A quest that was completed today, shown in the board's "DONE TODAY" strip. It is a
// deliberately SUPPRESSED, static sibling of QuestRow — second-plane surface, no completion
// gesture, no exit choreography: a completed quest is done and stays put here until tomorrow.
// The checkbox rests in its settled done state (`dl-check-settled`, drawn mark, no lime flash
// on load); the title strikes through and dims; tags/priority/rank stay present but faded.
// The title is the one live control: it emits `open`, which the page turns into a READ-ONLY
// preview modal. There is no un-complete / undo here — that is a separate, deferred concern.
//
// Enters with the same `dl-row-in` mount animation as the active list (delay rides in via the
// `--dl-stagger-delay` the page sets), so a row freshly slid off the active list reappears
// here with a subtle fade — never a fragile FLIP flight across the whole board.
const props = defineProps<{ quest: Quest }>();
const emit = defineEmits<{ open: [quest: Quest, event: MouseEvent] }>();

// High/low get a chevron beside the rank; normal renders nothing — same rule as QuestRow.
const marker = computed(() => priorityMarker(props.quest.priority));

// Tags: one full chip + a "+N" counter for the rest, mirroring QuestRow's collapse rule so the
// done row keeps the same width hierarchy (title wins, tags yield first).
const tags = computed(() => props.quest.tags ?? []);
const firstTag = computed(() => tags.value[0]);
const extraTagCount = computed(() => Math.max(0, tags.value.length - 1));
</script>

<template>
  <div class="dl-row-in flex flex-col">
    <div class="relative flex h-dl-row items-center gap-2 border border-dl-hairline bg-dl-sunk pl-3 pr-2 md:gap-3">
      <!-- 3px leading stripe in the done (lime) signal colour. -->
      <span class="absolute inset-y-0 left-0 w-[3px] bg-dl-lime" aria-hidden="true" />

      <!-- Resting done checkbox: the settled violet check, drawn statically (no flash on load). -->
      <span
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center opacity-80 md:min-h-0 md:min-w-0"
        aria-hidden="true"
      >
        <span class="dl-check dl-check-settled corner-cut-sm grid h-5 w-5 place-items-center border border-dl-violet bg-dl-violet">
          <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
            <path class="dl-check-mark" d="M4 8.5 L7 11.5 L12.5 5" stroke="#fff" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" />
          </svg>
        </span>
      </span>

      <!-- Title — struck through and dimmed; opens the read-only preview. -->
      <button
        type="button"
        class="dl-focus-inset min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-dl-body text-dl-ink-faint line-through [font:inherit] hover:text-dl-ink"
        @click="emit('open', quest, $event)"
      >
        {{ quest.title }}
      </button>

      <!-- Pinned right: tags → priority glyph → RankBadge, all faded to the second plane. -->
      <div class="flex shrink-0 items-center gap-2 opacity-60">
        <div v-if="firstTag" class="flex min-w-0 items-center gap-1">
          <TagChip :name="firstTag.name" :color="firstTag.color" />
          <span v-if="extraTagCount" class="font-dl-mono text-dl-label text-dl-ink-faint">+{{ extraTagCount }}</span>
        </div>
        <span
          v-if="marker"
          class="shrink-0 text-dl-meta leading-none"
          :class="PRIORITY_DL_CLASS[quest.priority]"
          :title="marker.label"
          :aria-label="marker.label"
          role="img"
        >{{ marker.glyph }}</span>
        <RankBadge :rank="quest.difficulty" class="shrink-0" />
      </div>
    </div>
  </div>
</template>
