<script setup lang="ts">
// Purely presentational: the centred hunter figure with a subtle purple wash.
</script>

<template>
  <div class="pointer-events-none absolute bottom-[19vh] left-1/2 w-[342px] max-w-[28.5vw] -translate-x-1/2 select-none">
    <!-- bottom-[19vh]: lifted off the very bottom just enough to clear the Items slot beneath the feet. -->
    <!-- multiply against the dark backdrop crushes the character — brightness/contrast/saturate lift it back up. -->
    <img
      class="block h-auto w-full mix-blend-multiply brightness-90 contrast-[.98] saturate-[1.05] drop-shadow-[0_0_40px_rgba(124,92,232,0.5)]"
      src="/images/character.svg"
      alt="Hunter character"
    />
    <!-- Very subtle purple wash over the character silhouette, brighter at the top.
         Masked to the same artwork so the tint only lands on the figure. -->
    <div
      class="character-tint absolute inset-0 bg-[linear-gradient(180deg,rgba(150,120,255,0.18),rgba(124,92,232,0.06)_45%,rgba(124,92,232,0)_80%)] mix-blend-screen"
    />
  </div>
</template>

<style scoped>
/* CSS mask (mask-image with a URL to the SVG) — Tailwind has no mask-image utility,
   so the mask properties are kept as CSS. */
.character-tint {
  -webkit-mask-image: url('/images/character.svg');
  mask-image: url('/images/character.svg');
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
</style>
