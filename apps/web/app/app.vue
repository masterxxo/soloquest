<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
/* Globalne style dokumentu (:root, body) — celują w elementy spoza szablonu,
   więc nie da się ich wyrazić klasami utility na `class`; zostają jako CSS. */
:root {
  color-scheme: dark;
}
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #d0c8f8;
}
</style>
