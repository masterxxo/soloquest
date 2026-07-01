<template>
  <div class="sq-root relative min-h-screen bg-cover bg-fixed bg-center bg-no-repeat">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
/* Global document styles (:root, body) — they target elements outside the template,
   so they can't be expressed as utility classes on `class`; kept as CSS. */
:root {
  color-scheme: dark;
}
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #d0c8f8;
}
/* Main site-wide background: a darkening gradient overlay layered over the backdrop
   image. Kept as CSS — a two-layer background-image (gradient + url) is brittle as an
   arbitrary utility. Size/position layers are set via bg-* classes on the element. */
.sq-root {
  background-image: linear-gradient(rgba(4, 2, 12, 0.55), rgba(4, 2, 12, 0.55)),
    url('/images/backdrop.png');
}
</style>
