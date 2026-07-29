<script setup lang="ts">
import { useFeedbackStore } from '~/stores/feedback';
import { useReducedMotion } from '~/composables/useReducedMotion';

// The Daylight toast stack (4c-3). The ONE container + type table for every short-lived toast;
// it decides where they sit (bottom-right on desktop, above the mobile nav on mobile) and how
// they stack. The feedback store owns the list, each toast's hold and its auto-dismiss timer;
// this component only renders and animates them.
//
// Three types, split ink/paper:
//   • achievement — ink card, gold: a cut badge holding the milestone THRESHOLD (never an XP
//     figure), a gold "ACHIEVEMENT" lead, white title, faint description.
//   • notice — paper card, 3px violet side bar: neutral system facts.
//   • error  — paper card, 3px magenta side bar: a request that failed.
// Every type carries a bottom progress bar in its own colour that empties over its hold.
//
// Motion is gated on `reduced` exactly like the RewardPanel: the enter/leave/move transitions
// are collapsed to their final state by the global guard in tokens.css, and the progress bar
// only animates when NOT reduced (otherwise it stands full — the JS dismiss timer still fires).
const feedback = useFeedbackStore();
const { reduced } = useReducedMotion();
</script>

<template>
  <!-- pointer-events-none throughout: toasts have no controls, so they never swallow a click
       meant for the list underneath. The container is bottom-anchored, so appending the newest
       toast last puts it nearest the corner and grows the stack upward. -->
  <div
    class="dl-toast-stack pointer-events-none fixed z-[60] flex flex-col gap-3 inset-x-3 bottom-[calc(env(safe-area-inset-bottom)_+_4.5rem)] md:inset-x-auto md:bottom-6 md:right-6 md:w-[360px] md:max-w-[calc(100vw_-_3rem)]"
  >
    <TransitionGroup name="dl-toast">
      <div
        v-for="t in feedback.toasts"
        :key="t.id"
        class="dl-toast corner-cut relative overflow-hidden"
        :style="{ '--dl-toast-delay': `${t.enterDelay}ms`, '--dl-toast-hold': `${t.hold}ms` }"
        :role="t.type === 'error' ? 'alert' : 'status'"
        :aria-live="t.type === 'error' ? 'assertive' : 'polite'"
      >
        <!-- ACHIEVEMENT — ink + gold. -->
        <div v-if="t.type === 'achievement'" class="flex items-start gap-3 bg-dl-ink px-4 py-3.5">
          <span
            class="corner-cut-sm mt-0.5 grid h-10 w-10 shrink-0 place-items-center border border-dl-gold font-dl-mono text-dl-meta font-semibold text-dl-gold"
          >{{ t.threshold }}</span>
          <div class="min-w-0">
            <p class="font-dl-mono text-dl-label uppercase tracking-[0.3em] text-dl-gold">Achievement</p>
            <p class="mt-0.5 font-dl-display text-dl-body font-semibold text-white">{{ t.title }}</p>
            <p v-if="t.description" class="mt-0.5 font-dl-sans text-dl-meta text-white/55">{{ t.description }}</p>
          </div>
        </div>

        <!-- NOTICE / ERROR — paper + a 3px side bar (violet / magenta). -->
        <div
          v-else
          class="border-l-[3px] bg-dl-surface px-4 py-3.5"
          :class="t.type === 'error' ? 'border-dl-magenta' : 'border-dl-violet'"
        >
          <p class="font-dl-sans text-dl-body text-dl-ink">{{ t.message }}</p>
        </div>

        <!-- Progress bar — bottom edge, type colour, empties over the hold. Stands full under
             reduced motion (the run class carries the only animation). -->
        <span
          class="dl-toast-bar absolute inset-x-0 bottom-0 h-[3px] origin-left"
          :class="[
            t.type === 'achievement' ? 'bg-dl-gold' : t.type === 'error' ? 'bg-dl-magenta' : 'bg-dl-violet',
            { 'dl-toast-bar-run': !reduced },
          ]"
          aria-hidden="true"
        />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Enter — slide in from the right (30px) + fade over 320ms, driven as an animation (not a
   transition) so a per-toast --dl-toast-delay staggers a batch that lands together. `both`
   holds the offset+hidden `from` state through the delay. Vue watches animationend to know
   when enter finishes. */
.dl-toast-enter-active {
  animation: dl-toast-in 320ms var(--dl-ease) both;
  animation-delay: var(--dl-toast-delay, 0ms);
}
@keyframes dl-toast-in {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
}

/* Leave — slide right + fade over 340ms in place; `dl-toast-move` then glides the remaining
   toasts into their new slots. The global reduced-motion guard collapses all three to instant. */
.dl-toast-leave-active {
  transition:
    transform 340ms var(--dl-ease),
    opacity 340ms var(--dl-ease);
}
.dl-toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.dl-toast-move {
  transition: transform 340ms var(--dl-ease);
}

.dl-toast {
  /* drop-shadow (not box-shadow): the corner-cut clip-path would clip a box-shadow away, but a
     filter drop-shadow follows the clipped silhouette and renders outside it. */
  filter: drop-shadow(0 10px 22px rgba(20, 17, 31, 0.28));
}

/* Progress bar — empties left→right over the toast's hold. Base state is full, so under reduced
   motion (guard zeroes the animation) it simply stands full while the JS timer still dismisses. */
.dl-toast-bar-run {
  animation: dl-toast-bar var(--dl-toast-hold, 4000ms) linear forwards;
}
@keyframes dl-toast-bar {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
</style>
