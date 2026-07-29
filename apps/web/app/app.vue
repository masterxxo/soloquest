<script setup lang="ts">
import { useFeedbackStore } from '~/stores/feedback';
import { RANK_LADDER } from '~/lib/ranks';
import { formatDate } from '~/lib/date';

// Global "System" feedback lives here, at the app root — above the layout shell and
// outside its clipped frame, so toasts stay anchored to the viewport regardless of the
// shell's clip-path/overflow. (Moved out of the layout during the Daylight redesign.)
const feedback = useFeedbackStore();

// Level up is no longer a toast — it's the RewardPanel overlay (4c-1). Its caption/announce are
// derived from the frozen snapshot the feedback store holds.
const levelUpCaption = computed(() =>
  feedback.levelUp
    ? `+${feedback.levelUp.xpGain.toLocaleString()} XP · next ${feedback.levelUp.xpForNext.toLocaleString()}`
    : '',
);

// Rank promotion (4c-2) — the SAME RewardPanel, tuned per tier. NOTE: nothing fires
// feedback.rankUp from the completion flow (rank thresholds are undefined — see
// detectRankPromotion in lib/ranks.ts); today it is reached only by the dev-only window.rankUp
// trigger. S is the one inverted moment: heavier brackets, longer hold, dark scene.
const isMaxRank = computed(() => feedback.rankUp?.rank === 'S');
const rankUpCaption = computed(() =>
  feedback.rankUp
    ? `promoted from ${feedback.rankUp.from} · ${formatDate(new Date(), { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '',
);
</script>

<template>
  <div class="min-h-[100dvh] bg-dl-bg text-dl-ink">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global "System" toasts (4c-3) — the bottom-right stack (above the mobile nav). One
         container owns their position + stacking; the feedback store owns their lifetimes. It
         sits below the RewardPanel (z-70) and never overlaps it (corner vs centre), so a
         level-up and an achievement can fire together without hiding each other. -->
    <ToastStack />

    <!-- Level up — the loudest of the frequent reward moments (4c-1). An overlay panel over the
         live list, not a toast; it owns its own hold + close and dismisses the store snapshot. -->
    <RewardPanel
      v-if="feedback.levelUp"
      label="LEVEL UP"
      :value="feedback.levelUp.level"
      :caption="levelUpCaption"
      :announce="`Level ${feedback.levelUp.level} reached`"
      @close="feedback.dismissLevelUp()"
    />

    <!-- Rank promotion (4c-2). Reached only by the dev trigger for now — see the note in the
         script and lib/ranks.ts. S rank inverts the whole scene. -->
    <RewardPanel
      v-if="feedback.rankUp"
      :label="isMaxRank ? 'RANK PROMOTION · MAXIMUM' : 'RANK PROMOTION'"
      :value="feedback.rankUp.rank"
      value-size="6rem"
      :caption="rankUpCaption"
      :announce="isMaxRank ? 'Maximum rank S attained' : `Rank ${feedback.rankUp.rank} attained`"
      :ladder="[...RANK_LADDER]"
      :brackets="isMaxRank ? 3 : 2"
      :hold="isMaxRank ? 5000 : 4000"
      :inverted="isMaxRank"
      @close="feedback.dismissRankUp()"
    />
  </div>
</template>

<style>
/* Global document styles (:root, body) — they target elements outside the template,
   so they can't be expressed as utility classes on `class`; kept as CSS. */
:root {
  color-scheme: light;
}
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #14111f;
}
</style>
