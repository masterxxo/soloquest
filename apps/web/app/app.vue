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

    <!-- Global "System" feedback. This container is the only thing that decides *where*
         toasts sit: they stack, gap-separated, so any combination (a level-up with a rank
         warning, say) reads without overlap, and each still owns its own lifetime. It stops
         short of the mobile nav bar and clips there rather than covering it. pointer-events-none
         keeps the empty container — which spans most of the viewport — from swallowing clicks;
         each toast opts back in. flex-col-reverse + justify-end: the stack still hangs from the
         top, but it grows downwards from the *last* toast, so a stack too tall for the container
         loses its first entry off the bottom rather than its most recent one. -->
    <div class="pointer-events-none fixed inset-x-0 bottom-[84px] top-6 z-[60] flex flex-col-reverse items-center justify-end gap-3 overflow-hidden px-3 pt-3 md:bottom-8">
      <NoticeToast
        :messages="feedback.notice?.messages ?? []"
        :variant="feedback.notice?.variant ?? 'warning'"
      />
      <AchievementToast :achievements="feedback.achievements" />
    </div>

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
