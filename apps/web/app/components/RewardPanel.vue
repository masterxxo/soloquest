<script setup lang="ts">
import { useModalStackStore } from '~/stores/modalStack';
import { useReducedMotion } from '~/composables/useReducedMotion';

// A reusable reward "moment" — an overlay panel that floats above the (still-live) list. Used by
// level up (4c-1) and rank promotion (4c-2). Everything that differs between tiers is a prop:
// bracket layers, hold, an optional rank ladder, and the S-rank screen `inverted` mode. NOT
// hardcoded to any single moment.
//
// The list stays interactive underneath (no blocking backdrop): the overlay is pointer-events
// -none except the panel itself, and a document listener closes on an outside press WITHOUT
// consuming it, so that press still reaches the list. Escape closes via the shared modal stack.
//
// Timings are runtime-verified (see the scoped keyframes), not from the design board.
const props = withDefaults(
  defineProps<{
    label: string; // e.g. "LEVEL UP" / "RANK PROMOTION"
    value: string | number; // the large glitched display — a level number or a rank glyph
    caption?: string; // e.g. "+120 XP · next 1,000" / "promoted from B · 29 Jul 2026"
    announce: string; // screen-reader text, e.g. "Level 25 reached" / "Maximum rank S attained"
    brackets?: number; // nested L-bracket layers per corner (1 = level up, 2 = rank, 3 = S)
    hold?: number; // ms the panel dwells before auto-closing
    ladder?: string[]; // optional rank ladder E→S; the entry equal to `value` is highlighted
    inverted?: boolean; // S-rank screen inversion (dark scene, white glyph) — the ONLY inverted moment
    valueSize?: string; // font-size of the big value (rank glyph is larger than a level number)
  }>(),
  { caption: '', brackets: 1, hold: 3000, ladder: undefined, inverted: false, valueSize: '3.5rem' },
);
const emit = defineEmits<{ close: [] }>();

const { reduced } = useReducedMotion();

// Bracket start (260ms) → corners slide in; the hold bar starts at 700ms and empties over `hold`;
// auto-close fires when it empties. All in one place so the JS timer and CSS agree.
const BAR_START_MS = 700;

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;
// One <span> per corner per layer; nested layers step inward 6px so double/triple brackets nest.
const bracketEls = computed(() =>
  Array.from({ length: props.brackets }, (_, layer) =>
    CORNERS.map((corner) => ({ key: `${corner}-${layer}`, corner, inset: layer * 6 })),
  ).flat(),
);

const shown = ref(false); // drives the enter/leave transition; false → leave → @after-leave → close
const panelEl = ref<HTMLElement | null>(null);
const modalStack = useModalStackStore();
let modalId: number | null = null;
let holdTimer: ReturnType<typeof setTimeout> | null = null;

function requestClose() {
  shown.value = false;
}
function onOutsidePress(e: Event) {
  // Close on a press outside the panel, but do NOT consume it — the list underneath still gets
  // the click, so the panel never blocks work.
  if (panelEl.value && !panelEl.value.contains(e.target as Node)) requestClose();
}

onMounted(() => {
  shown.value = true;
  modalId = modalStack.registerModal(requestClose); // Escape → closeTop → requestClose
  // Auto-close after the hold bar empties. Runs even under reduced motion (JS timer, not CSS).
  holdTimer = setTimeout(requestClose, BAR_START_MS + props.hold);
  // Defer the outside-press listener one tick so the interaction that produced the moment can't
  // immediately close a panel that only just mounted.
  nextTick(() => document.addEventListener('pointerdown', onOutsidePress));
});
onBeforeUnmount(() => {
  if (holdTimer) clearTimeout(holdTimer);
  if (modalId !== null) modalStack.unregisterModal(modalId);
  document.removeEventListener('pointerdown', onOutsidePress);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="dl-reward" @after-leave="emit('close')">
      <div
        v-if="shown"
        class="dl-reward-overlay pointer-events-none fixed inset-0 z-[70] grid place-items-center p-4"
      >
        <!-- S-rank only: full-screen ink inversion behind the panel. The grow is gated on !reduced
             (a full-screen animated flip is the sharpest flash-adjacent effect in the system); when
             reduced it is simply present, no flip. -->
        <span
          v-if="inverted"
          class="dl-reward-invert"
          :class="{ 'dl-reward-invert-grow': !reduced }"
          aria-hidden="true"
        />

        <!-- Unclipped wrapper: holds the glow + brackets + hold bar, which extend OUTSIDE the
             frame's clip-path. The corner-cut lives on the inner frame only. -->
        <div
          ref="panelEl"
          class="dl-reward-panel pointer-events-auto relative"
          :class="{ 'is-inverted': inverted }"
          role="status"
          aria-live="polite"
        >
          <!-- Violet radial glow behind the panel. -->
          <span class="dl-reward-glow" aria-hidden="true" />

          <!-- L brackets (four corners × layers) that slide in from outside the frame. -->
          <span
            v-for="b in bracketEls"
            :key="b.key"
            class="dl-reward-bracket"
            :class="`dl-reward-bracket-${b.corner}`"
            :style="{ '--dl-bracket-inset': `${b.inset}px` }"
            aria-hidden="true"
          />

          <div class="dl-reward-frame corner-cut relative border px-10 py-8 text-center">
            <div class="flex flex-col items-center gap-1">
              <p class="dl-reward-label font-dl-mono text-dl-label uppercase tracking-[0.3em]">{{ label }}</p>
              <p
                class="dl-reward-value font-dl-display font-bold leading-none"
                :class="{ 'dl-reward-glitch': !reduced }"
                :style="{ '--dl-reward-value-size': valueSize }"
              >{{ value }}</p>

              <!-- Rank ladder E→S with the newly reached band lit. -->
              <div v-if="ladder" class="dl-reward-ladder">
                <span
                  v-for="r in ladder"
                  :key="r"
                  class="dl-reward-rank"
                  :class="{ 'is-active': r === String(value) }"
                >{{ r }}</span>
              </div>

              <p v-if="caption" class="dl-reward-caption font-dl-mono text-dl-meta">{{ caption }}</p>
            </div>
          </div>

          <!-- Hold countdown bar (bottom edge). Stands full under reduced motion. -->
          <span
            class="dl-reward-holdbar"
            :class="{ 'dl-reward-holdbar-run': !reduced }"
            :style="{ '--dl-hold': `${hold}ms` }"
            aria-hidden="true"
          />

          <span class="sr-only">{{ announce }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Enter: overlay opacity 0→1 (300ms); the PANEL pops scale .94→1 separately (so the full-screen
   inversion layer, a child of the overlay, is never scaled). Leave: overlay opacity→0. The
   reduced-motion guard in tokens.css collapses all of these to their final state. */
.dl-reward-enter-active,
.dl-reward-leave-active {
  transition: opacity 300ms var(--dl-ease);
}
.dl-reward-enter-from,
.dl-reward-leave-to {
  opacity: 0;
}

/* Full-screen ink inversion (S rank). Present by default; grows in over ~200ms when not reduced. */
.dl-reward-invert {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #14111f;
}
.dl-reward-invert-grow {
  animation: dl-reward-invert-in 200ms var(--dl-ease) both;
}
@keyframes dl-reward-invert-in {
  from {
    opacity: 0;
  }
}

.dl-reward-panel {
  position: relative;
  z-index: 10;
  animation: dl-reward-pop 400ms var(--dl-ease) both;
}
@keyframes dl-reward-pop {
  from {
    transform: scale(0.94);
  }
}

/* The visible box: corner-cut clips only here, so the glow/brackets/hold bar (siblings in the
   unclipped wrapper) can extend past it. Sits above the glow (z-1); brackets/bar sit above it. */
.dl-reward-frame {
  z-index: 1;
  min-width: 16rem;
  border-color: var(--dl-violet);
  background: #ffffff;
  box-shadow: 0 24px 60px -20px rgba(91, 47, 224, 0.5);
}
.dl-reward-label {
  color: var(--dl-violet);
}
.dl-reward-value {
  font-size: var(--dl-reward-value-size, 3.5rem);
  color: #14111f;
  /* isolate the glitch translateX from the panel's scale */
  will-change: transform;
}
.dl-reward-caption {
  color: #6a6683;
}

/* Rank ladder. */
.dl-reward-ladder {
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
}
.dl-reward-rank {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid #ddd9ec;
  color: #a6a1be;
  font-family: 'Chakra Petch', ui-sans-serif, system-ui, sans-serif;
  font-weight: 600;
  font-size: 0.8rem;
}
.dl-reward-rank.is-active {
  border-color: var(--dl-violet);
  background: #efeaff;
  color: #14111f;
}

/* ── S-rank inverted scene ─────────────────────────────────────────────────────────────────── */
.is-inverted .dl-reward-frame {
  background: #14111f;
  border-color: #7c5ce8;
}
.is-inverted .dl-reward-label {
  color: #7c5ce8;
}
.is-inverted .dl-reward-value {
  color: #ffffff;
}
.is-inverted .dl-reward-caption {
  color: #a6a1be;
}
.is-inverted .dl-reward-rank {
  border-color: #3a2d6e;
  color: #6a6683;
}
.is-inverted .dl-reward-rank.is-active {
  border-color: #7c5ce8;
  background: rgba(124, 92, 232, 0.25);
  color: #ffffff;
  box-shadow: 0 0 12px rgba(124, 92, 232, 0.6);
}

/* Violet radial glow, growing in behind the panel. Base state is fully present, so under reduced
   motion (guard zeroes the animation) it simply shows. */
.dl-reward-glow {
  position: absolute;
  inset: -45%;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(circle, rgba(124, 92, 232, 0.55), rgba(124, 92, 232, 0) 68%);
  animation: dl-reward-glow-in 400ms var(--dl-ease) both;
}
@keyframes dl-reward-glow-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

/* L brackets — a 22px box showing only two sides (2.5px violet). Slide in from outside the frame
   at 260ms. `both` holds the offset before and the settled position after; the guard makes it
   instant (settled) under reduced motion. */
.dl-reward-bracket {
  position: absolute;
  z-index: 20;
  width: 22px;
  height: 22px;
  border: 0 solid var(--dl-violet);
  animation: dl-reward-bracket-in 400ms var(--dl-ease) 260ms both;
}
.is-inverted .dl-reward-bracket {
  border-color: #7c5ce8;
}
.dl-reward-bracket-tl {
  top: calc(-3px + var(--dl-bracket-inset));
  left: calc(-3px + var(--dl-bracket-inset));
  border-top-width: 2.5px;
  border-left-width: 2.5px;
  --dl-bracket-fx: -26px;
  --dl-bracket-fy: -26px;
}
.dl-reward-bracket-tr {
  top: calc(-3px + var(--dl-bracket-inset));
  right: calc(-3px + var(--dl-bracket-inset));
  border-top-width: 2.5px;
  border-right-width: 2.5px;
  --dl-bracket-fx: 26px;
  --dl-bracket-fy: -26px;
}
.dl-reward-bracket-bl {
  bottom: calc(-3px + var(--dl-bracket-inset));
  left: calc(-3px + var(--dl-bracket-inset));
  border-bottom-width: 2.5px;
  border-left-width: 2.5px;
  --dl-bracket-fx: -26px;
  --dl-bracket-fy: 26px;
}
.dl-reward-bracket-br {
  bottom: calc(-3px + var(--dl-bracket-inset));
  right: calc(-3px + var(--dl-bracket-inset));
  border-bottom-width: 2.5px;
  border-right-width: 2.5px;
  --dl-bracket-fx: 26px;
  --dl-bracket-fy: 26px;
}
@keyframes dl-reward-bracket-in {
  from {
    opacity: 0;
    transform: translate(var(--dl-bracket-fx, 0), var(--dl-bracket-fy, 0));
  }
}

/* Chromatic-split glitch on the value — 3 flashes at ~560 / 1760 / 2960ms, each 200ms in 2 steps,
   6px channel offset. NO fill, so the split fringe only exists during a flash and the glyph is
   clean between them. Applied only when motion is NOT reduced: the whole split layer is gated
   (a static magenta/cyan fringe would be worse than the animation — it is a flash-adjacent effect,
   a photosensitivity/vestibular risk, so it is removed entirely, not merely slowed). */
.dl-reward-glitch {
  animation:
    dl-reward-split 200ms steps(2) 560ms,
    dl-reward-split 200ms steps(2) 1760ms,
    dl-reward-split 200ms steps(2) 2960ms;
}
/* 0% and 50% are the two frames `steps(2)` samples — each a distinct split direction, so the
   flicker never lands on a centered (no-split) frame. No fill: the glyph is clean between/after. */
@keyframes dl-reward-split {
  0% {
    text-shadow:
      6px 0 #ff2e63,
      -6px 0 #00c2d9;
    transform: translateX(2px);
  }
  50% {
    text-shadow:
      -6px 0 #ff2e63,
      6px 0 #00c2d9;
    transform: translateX(-2px);
  }
}

/* Hold bar — 1px violet, empties left→right over `hold` starting at 700ms. */
.dl-reward-holdbar {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 20;
  height: 1px;
  width: 100%;
  background: var(--dl-violet);
  transform-origin: left;
}
.is-inverted .dl-reward-holdbar {
  background: #7c5ce8;
}
.dl-reward-holdbar-run {
  animation: dl-reward-holdbar var(--dl-hold, 3000ms) linear 700ms forwards;
}
@keyframes dl-reward-holdbar {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
</style>
