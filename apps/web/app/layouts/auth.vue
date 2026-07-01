<script setup lang="ts">
// Layout for the login / register screens: the full-bleed backdrop with drifting
// smoke and a centred panel. The app pages use the grimoire `default` layout instead.
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center text-ink">
    <!-- The main background (backdrop + overlay) is now global in app.vue (.sq-root);
         the auth layout only centres the login/register panel over it. -->
    <SmokeCanvas :density="1.5" :speed="1.0" />
    <slot />
  </div>
</template>
