<script setup lang="ts">
// Layout for the login / register screens: the full-bleed backdrop with drifting
// smoke and a centred panel. The app pages use the grimoire `default` layout instead.
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center text-ink">
    <!-- Główne tło (backdrop + nakładka) jest teraz globalne w app.vue (.sq-root);
         layout auth tylko centruje panel logowania/rejestracji nad tym tłem. -->
    <SmokeCanvas :density="1.5" :speed="1.0" />
    <slot />
  </div>
</template>
