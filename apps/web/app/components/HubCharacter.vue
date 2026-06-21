<script setup lang="ts">
// Purely presentational: the centred hunter figure with a subtle purple wash.
</script>

<template>
  <div class="character">
    <img class="character-img" src="/images/character.svg" alt="Hunter character" />
    <div class="character-tint" />
  </div>
</template>

<style scoped>
.character {
  position: absolute;
  /* Lifted off the very bottom just enough to clear the Items slot beneath the feet. */
  bottom: 19vh;
  left: 50%;
  transform: translateX(-50%);
  width: 342px;
  max-width: 28.5vw;
  pointer-events: none;
  user-select: none;
}
.character-img {
  display: block;
  width: 100%;
  height: auto;
  mix-blend-mode: multiply;
  /* multiply against the dark backdrop crushes the character — lift it back up. */
  filter: brightness(0.9) contrast(0.98) saturate(1.05)
    drop-shadow(0 0 40px rgba(124, 92, 232, 0.5));
}
/* Very subtle purple wash over the character silhouette, brighter at the top.
   Masked to the same artwork so the tint only lands on the figure. */
.character-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(150, 120, 255, 0.18),
    rgba(124, 92, 232, 0.06) 45%,
    rgba(124, 92, 232, 0) 80%
  );
  mix-blend-mode: screen;
  -webkit-mask-image: url('/images/character.svg');
  mask-image: url('/images/character.svg');
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
</style>
