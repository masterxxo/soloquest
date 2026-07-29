<script setup lang="ts">
import type { Quest, CompleteResult } from '~/lib/api-client';
import { useQuestActions } from '~/composables/useQuestActions';
import { useReducedMotion } from '~/composables/useReducedMotion';
import { priorityMarker, PRIORITY_DL_CLASS } from '~/lib/priority';
import { localDateString } from '~/lib/date';

// The Daylight quest row — the list's atomic unit (56px; sub-tasks 40/44). It is a NEW
// component, not a re-skin of QuestCard: QuestCard still renders the grimoire QuestDetail
// sub-task list, so the two evolve independently until that surface migrates.
//
// Anatomy (groups, not a flat list): a 3px status stripe on the leading edge, then checkbox →
// title (grows, wins width). Pinned to the right: tags → priority glyph → RankBadge. When space
// runs short the tags yield first (collapse to a "+N" counter) and the title yields last; the
// RankBadge and priority glyph never disappear. Completion is the checkbox; the title opens the
// detail modal (where edit/delete live) — no per-row action buttons, per the design.
const props = withDefaults(
  defineProps<{
    quest: Quest;
    isSubTask?: boolean;
    // Title becomes a button that emits `open` (the list opens detail); forwarded to sub-tasks.
    selectable?: boolean;
    // Render nested sub-tasks. The list's "Hide sub-tasks" filter turns this off.
    showSubTasks?: boolean;
    // Cascade wave (set by a completing parent on its sub-task rows): when `cascadePlay` turns on,
    // play the SAME checkbox gesture as a real complete after `cascadeDelay`ms — no request of the
    // row's own (the parent's transaction already closed it). Toggled back off = the parent's
    // request failed → revert.
    cascadePlay?: boolean;
    cascadeDelay?: number | null;
  }>(),
  {
    isSubTask: false,
    selectable: false,
    showSubTasks: true,
    cascadePlay: false,
    cascadeDelay: null,
  },
);
const emit = defineEmits<{
  // Immediate drop (reduced motion, sub-tasks, the 409/detail paths): apply + remove now.
  completed: [result: CompleteResult];
  // Reward granted (top-level animated path): apply player XP now so the counter rolls during the
  // "done" hold, WITHOUT yet dropping the row from the list.
  granted: [result: CompleteResult];
  // The slide has finished: drop the quest from the store and collapse the placeholder.
  exitDone: [payload: { result: CompleteResult; placeholder: HTMLElement | null }];
  deleted: [id: string];
  open: [quest: Quest, event: MouseEvent];
}>();

const isActive = computed(() => props.quest.status === 'active');
const isDone = computed(() => props.quest.status !== 'active');

// Leading status stripe. Only overdue/today/done carry a signal colour; everything else keeps a
// neutral rail so every row reads as framed. Derived from the quest itself (deadline in the
// user's local day), so it stays correct even inside a nested sub-task.
const state = computed<'overdue' | 'today' | 'done' | 'none'>(() => {
  if (isDone.value) return 'done';
  const dl = props.quest.deadline;
  if (!dl) return 'none';
  const day = localDateString(new Date(dl));
  const today = localDateString();
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  return 'none';
});
const stripeClass = computed(
  () =>
    ({
      overdue: 'bg-dl-magenta',
      today: 'bg-dl-violet',
      done: 'bg-dl-lime',
      none: 'bg-dl-grid-line',
    })[state.value],
);

// High/low get a chevron beside the rank; normal renders nothing.
const marker = computed(() => priorityMarker(props.quest.priority));

// Tags: one full chip + a "+N" counter for the rest — collapses cleanly and matches the mobile
// "one chip + counter" rule without needing per-breakpoint measurement.
const tags = computed(() => props.quest.tags ?? []);
const firstTag = computed(() => tags.value[0]);
const extraTagCount = computed(() => Math.max(0, tags.value.length - 1));

const { reduced } = useReducedMotion();
const root = ref<HTMLElement | null>(null);

// The complete result is captured (not emitted) here so THIS component owns the timeline: the
// store drop is deferred until the exit animation is over, instead of firing the instant the
// request resolves.
let pendingResult: CompleteResult | null = null;
const { completing, errorMsg, onComplete } = useQuestActions(
  () => props.quest,
  { completed: (r) => { pendingResult = r; }, deleted: (id) => emit('deleted', id) },
);

// Local reward state, set the instant the checkbox is pressed — the checkbox settles and the title
// strikes immediately (via CSS), decoupled from the network round-trip. Only a failed request
// rolls it back, so the checkbox never lies about an active quest.
const playing = ref(false);
const rewarding = computed(() => playing.value || isDone.value);

// The complete choreography is ~1.95s for a lone row (runtime-verified, see tokens.css). Beats,
// from the click:
//   0ms      checkbox flash lime → settle violet + checkmark draws (CSS, via `.dl-check-on`)
//   ~440ms   checkmark finished
//   ~950ms   START the exit — a deliberate ~500ms hold on "done" so completion registers
//   +600ms   slide finished → drop from store + collapse placeholder (owned by the page)
// A parent WITH sub-tasks runs a downward wave first: the parent gesture at 0ms, then each active
// sub-task +190ms (WAVE_STEP_MS — RUNTIME-VERIFIED; the board's 70ms read as a simultaneous blink).
// The exit start is pushed out by the wave length so it still begins ~500ms after the LAST child
// settles, then the whole group (this root already wraps the sub-tasks) slides out as one block —
// ~2.5s for 3 children.
const EXIT_START_MS = 950;
const SLIDE_MS = 600;
const WAVE_STEP_MS = 190;
let exitTimer: ReturnType<typeof setTimeout> | null = null;
let cascadeTimer: ReturnType<typeof setTimeout> | null = null;

// Parent → children signal: turned on when this row (a parent) completes, passed down as each
// sub-task's `cascadePlay`. Turned back off if the request fails, which reverts the children.
const cascading = ref(false);

// The active sub-tasks a parent complete will cascade AND that are on screen to animate. Hidden
// sub-tasks → empty → a parent behaves exactly like a lone row. Empty for a sub-task row itself.
const cascadeChildren = computed(() =>
  props.showSubTasks && props.quest.subTasks
    ? props.quest.subTasks.filter((st) => st.status === 'active')
    : [],
);
// Per-child wave delay down the group; `null` for rows outside the cascade (already-done children).
function childCascadeDelay(st: Quest): number | null {
  const i = cascadeChildren.value.findIndex((c) => c.id === st.id);
  return i === -1 ? null : (i + 1) * WAVE_STEP_MS;
}

// This row is a sub-task being swept by its parent's cascade: play the identical checkbox gesture
// (no request of its own — the parent's transaction already closed it) after our delay. A parent
// request that fails toggles `cascadePlay` back off, reverting us. Optimistic, like the lone row.
watch(
  () => props.cascadePlay,
  (on) => {
    if (cascadeTimer) { clearTimeout(cascadeTimer); cascadeTimer = null; }
    if (on && props.cascadeDelay != null && isActive.value) {
      cascadeTimer = setTimeout(() => { playing.value = true; }, props.cascadeDelay);
    } else if (!on) {
      playing.value = false;
    }
  },
);

async function handleComplete() {
  if (playing.value) return;
  playing.value = true;
  // Fire the sub-task wave immediately (optimistic) unless motion is reduced — the children then
  // settle on the 0/190/380/570ms cadence while the request is still in flight.
  if (!reduced.value && cascadeChildren.value.length) cascading.value = true;
  const t0 = performance.now();
  pendingResult = null;
  try {
    await onComplete();
  } catch {
    playing.value = false; // network error — revert this row and the whole cascade
    cascading.value = false;
    return;
  }
  // Handled failure kept the group on screen (errorMsg set); undo the reward everywhere.
  if (errorMsg.value !== null) { playing.value = false; cascading.value = false; return; }
  // 409 already emitted `deleted` (its XP was granted elsewhere) — nothing to animate.
  if (!pendingResult) return;
  const result = pendingResult;

  // Reduced motion, sub-tasks and the (rare) missing-element case skip the choreography entirely:
  // apply + drop at once. Under reduced motion the checkboxes are already in their done state
  // instantly (CSS guard), so this reads as a clean, immediate completion of the whole group.
  if (reduced.value || props.isSubTask || !root.value) {
    emit('completed', result);
    return;
  }

  // Grant XP now — ONE roll of the whole cascade's summed total (result.player is post-cascade),
  // never one roll per child.
  emit('granted', result);
  // Push the exit past the wave: it begins ~500ms after the LAST child settles (or ~950ms for a
  // lone row, where cascadeChildren is empty). Measured from the click so it holds regardless of
  // how fast the request resolved.
  const exitAt = EXIT_START_MS + cascadeChildren.value.length * WAVE_STEP_MS;
  const wait = Math.max(0, exitAt - (performance.now() - t0));
  exitTimer = setTimeout(() => startExit(result), wait);
}

// Placeholder-holds-space exit (imperative, per the verified pattern — NOT a TransitionGroup leave):
// drop a same-size empty box into the row's slot, pin the row absolute above its neighbours, slide
// it off to the right, then hand the placeholder to the page to collapse once the row is gone.
function startExit(result: CompleteResult) {
  const el = root.value;
  const container = el?.parentElement ?? null;
  if (!el || !container) { emit('completed', result); return; }

  const top = el.offsetTop;
  const left = el.offsetLeft;
  const width = el.offsetWidth;
  const height = el.offsetHeight;

  const placeholder = document.createElement('div');
  placeholder.className = 'dl-row-placeholder';
  placeholder.style.height = `${height}px`;
  placeholder.style.marginTop = '0px';
  el.after(placeholder);

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  el.style.position = 'absolute';
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
  el.style.width = `${width}px`;
  el.style.zIndex = '20';
  el.classList.add('dl-row-exit');
  // Two frames so the browser commits the pinned start state before the transform transitions.
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('dl-row-exit-go')));

  exitTimer = setTimeout(() => emit('exitDone', { result, placeholder }), SLIDE_MS);
}

onUnmounted(() => {
  if (exitTimer) clearTimeout(exitTimer);
  if (cascadeTimer) clearTimeout(cascadeTimer);
});

// Row height: 56px top-level; sub-tasks 44 (touch) / 40 (pointer).
const rowHeight = computed(() =>
  props.isSubTask ? 'h-dl-subrow-touch md:h-dl-subrow' : 'h-dl-row',
);
</script>

<template>
  <div ref="root" class="dl-row-in flex flex-col">
    <div
      class="relative flex items-center gap-2 border border-dl-hairline bg-dl-surface pl-3 pr-2 md:gap-3"
      :class="rowHeight"
    >
      <!-- 3px leading status stripe. -->
      <span class="absolute inset-y-0 left-0 w-[3px]" :class="stripeClass" aria-hidden="true" />

      <!-- Checkbox — completes the quest. 44px touch target; a 20px cut box inside. On press the
           box flashes lime → settles violet (~190ms) and the checkmark draws in (finishes ~440ms),
           driven by `.dl-check-on`; reduced motion collapses that to the settled state at once. -->
      <button
        v-if="isActive"
        type="button"
        role="checkbox"
        :aria-checked="rewarding"
        :aria-label="`Complete ${quest.title}`"
        :disabled="completing"
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center disabled:cursor-not-allowed md:min-h-0 md:min-w-0"
        :class="completing ? 'cursor-progress' : 'cursor-pointer'"
        @click="handleComplete"
      >
        <span
          class="dl-check corner-cut-sm grid h-5 w-5 place-items-center border bg-dl-surface transition-colors duration-dl-standard ease-dl"
          :class="rewarding ? 'dl-check-on border-dl-violet' : 'border-dl-band-line hover:border-dl-violet'"
        >
          <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
            <path class="dl-check-mark" d="M4 8.5 L7 11.5 L12.5 5" stroke="#fff" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" />
          </svg>
        </span>
      </button>
      <!-- Done: the settled violet check (only ever the brief optimistic moment before the row
           leaves). -->
      <span
        v-else
        class="grid min-h-dl-touch min-w-dl-touch shrink-0 place-items-center md:min-h-0 md:min-w-0"
        aria-hidden="true"
      >
        <span class="dl-check dl-check-on corner-cut-sm grid h-5 w-5 place-items-center border border-dl-violet bg-dl-violet">
          <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
            <path class="dl-check-mark" d="M4 8.5 L7 11.5 L12.5 5" stroke="#fff" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" />
          </svg>
        </span>
      </span>

      <!-- Title — grows, wins width. Opens detail when selectable. -->
      <button
        v-if="selectable"
        type="button"
        class="dl-strike dl-focus-inset min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-dl-body text-dl-ink [font:inherit] hover:text-dl-violet"
        :class="rewarding ? 'dl-strike-on text-dl-ink-faint' : ''"
        @click="emit('open', quest, $event)"
      >
        {{ quest.title }}
      </button>
      <span
        v-else
        class="dl-strike min-w-0 flex-1 truncate text-dl-body text-dl-ink"
        :class="rewarding ? 'dl-strike-on text-dl-ink-faint' : ''"
      >{{ quest.title }}</span>

      <!-- Pinned right: tags → priority glyph → RankBadge. -->
      <div class="flex shrink-0 items-center gap-2">
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

    <p v-if="errorMsg" class="mt-1 pl-3 text-dl-meta text-dl-magenta">{{ errorMsg }}</p>

    <!-- Nested sub-tasks: indented ~30px, same anatomy at a smaller scale. Capped at one level
         (`show-sub-tasks="false"`), so a row can never recurse into itself. -->
    <div v-if="showSubTasks && quest.subTasks?.length" class="mt-1 flex flex-col gap-1 pl-[30px]">
      <QuestRow
        v-for="st in quest.subTasks"
        :key="st.id"
        :quest="st"
        is-sub-task
        :selectable="selectable"
        :show-sub-tasks="false"
        :cascade-play="cascading"
        :cascade-delay="childCascadeDelay(st)"
        @open="(q, e) => emit('open', q, e)"
        @completed="(r) => emit('completed', r)"
        @deleted="(id) => emit('deleted', id)"
      />
    </div>
  </div>
</template>
