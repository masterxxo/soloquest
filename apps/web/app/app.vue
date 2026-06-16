<template>
  <div class="sq-root">
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
  min-height: 100vh;
  background: radial-gradient(circle at 50% 0%, #0d1b3a 0%, #05070f 60%);
  color: #cfe3ff;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
}
</style>
