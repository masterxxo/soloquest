<script setup lang="ts">
// Layout for the login / register screens. It speaks the Daylight language — the 1px
// grid-line frame with cut corners, flat dl-bg, mono-caps technical marks and the brand
// "S" marker — but WITHOUT the app chrome the shell (default.vue) carries: before sign-in
// there is no nav gutter (nowhere to navigate) and no telemetry bar (no player/XP/level).
// The pages drop a single white form panel into the centred construction area.
</script>

<template>
  <!-- Same 1px dl-grid-line frame as the app shell: outer layer is the frame line
       (grid-line fill + 1px padding), inner is the surface, both clipped by corner-cut. -->
  <div class="corner-cut flex h-[100dvh] w-full overflow-hidden bg-dl-grid-line p-px text-dl-ink">
    <div class="corner-cut flex min-h-0 w-full flex-1 flex-col bg-dl-bg">

      <!-- Top band — brand identity. The "S" marker (white on violet, 6px cut) anchors the
           wordmark; a mono-caps technical label sits at the far edge. -->
      <header class="flex shrink-0 items-center gap-3 border-b border-dl-band-line px-4 py-3 md:px-6">
        <span class="corner-cut-sm flex h-9 w-9 items-center justify-center bg-dl-violet font-dl-display text-dl-title font-bold text-white">S</span>
        <span class="font-dl-display text-dl-body font-semibold tracking-wide text-dl-ink">SoloQuest</span>
        <span class="ml-auto font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Operator access</span>
      </header>

      <!-- Construction area — the only scroll region, so a short viewport scrolls the panel
           instead of growing the frame. Faint corner crosshairs read as technical identity. -->
      <main class="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8">
        <span aria-hidden="true" class="pointer-events-none absolute left-4 top-4 select-none font-dl-mono text-dl-label text-dl-ink-faint">+</span>
        <span aria-hidden="true" class="pointer-events-none absolute right-4 top-4 select-none font-dl-mono text-dl-label text-dl-ink-faint">+</span>
        <span aria-hidden="true" class="pointer-events-none absolute bottom-4 left-4 select-none font-dl-mono text-dl-label text-dl-ink-faint">+</span>
        <span aria-hidden="true" class="pointer-events-none absolute bottom-4 right-4 select-none font-dl-mono text-dl-label text-dl-ink-faint">+</span>
        <slot />
      </main>

      <!-- Bottom band — mono-caps micro-labels, matching the header divider weight. -->
      <footer class="flex shrink-0 items-center justify-between border-t border-dl-band-line px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-faint md:px-6">
        <span>Sec · Auth</span>
        <span>Operator terminal</span>
      </footer>
    </div>
  </div>
</template>
