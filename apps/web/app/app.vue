<script setup lang="ts">
import { useFeedbackStore } from '~/stores/feedback';

// Global "System" feedback lives here, at the app root — above the layout shell and
// outside its clipped frame, so toasts stay anchored to the viewport regardless of the
// shell's clip-path/overflow. (Moved out of the layout during the Daylight redesign.)
const feedback = useFeedbackStore();
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
      <LevelUpToast :level="feedback.levelUpTo" />
      <NoticeToast
        :messages="feedback.notice?.messages ?? []"
        :variant="feedback.notice?.variant ?? 'warning'"
      />
      <AchievementToast :achievements="feedback.achievements" />
    </div>
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
