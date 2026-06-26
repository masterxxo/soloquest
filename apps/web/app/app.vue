<template>
  <div class="sq-root">
    <SmokeCanvas :density="1.5" :speed="1.0" />
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}
body {
  margin: 0;
}
.sq-root {
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
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  /* Centres the login/register panels; the dashboard fills the viewport on its own. */
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
