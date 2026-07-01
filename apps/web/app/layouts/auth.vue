<script setup lang="ts">
// Layout for the login / register screens: the full-bleed backdrop with drifting
// smoke and a centred panel. The app pages use the grimoire `default` layout instead.
</script>

<template>
  <div class="auth-root relative flex min-h-screen items-center justify-center bg-cover bg-fixed bg-center bg-no-repeat text-ink">
    <!-- Centres the login/register panels; bg-* utilities pair with the layered
         background-image kept in CSS below. -->
    <SmokeCanvas :density="1.5" :speed="1.0" />
    <slot />
  </div>
</template>

<style scoped>
/* Zostaje jako CSS: dwuwarstwowe background-image (nakładka gradientu + url do
   backdropu) trudne do wiernego wyrażenia w utility, a poniższy komentarz
   projektowy jest istotny. */
.auth-root {
  /* Dark overlay rgba(4,2,12,0.55) layered over the backdrop image. Done as a
     gradient background (not a positioned element) so it never paints over the
     statically-positioned login/register panels. */
  background-image: linear-gradient(rgba(4, 2, 12, 0.55), rgba(4, 2, 12, 0.55)),
    url('/images/backdrop.png');
}
</style>
