<script setup lang="ts">
// Layout for the login / register screens: the full-bleed backdrop with drifting
// smoke and a centred panel. The app pages use the grimoire `default` layout instead.
</script>

<template>
  <div class="auth-root">
    <SmokeCanvas :density="1.5" :speed="1.0" />
    <slot />
  </div>
</template>

<style scoped>
.auth-root {
  position: relative;
  min-height: 100vh;
  /* Dark overlay rgba(4,2,12,0.55) layered over the backdrop image. Done as a
     gradient background (not a positioned element) so it never paints over the
     statically-positioned login/register panels. */
  background-image: linear-gradient(rgba(4, 2, 12, 0.55), rgba(4, 2, 12, 0.55)),
    url('/images/backdrop.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  color: #d0c8f8;
  /* Centres the login/register panels. */
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
