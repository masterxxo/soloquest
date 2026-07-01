<template>
  <div class="sq-root relative min-h-screen bg-cover bg-fixed bg-center bg-no-repeat">
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
/* Główne tło całej strony: przyciemniająca nakładka gradientu nałożona na obraz
   backdrop. Zostaje jako CSS — dwuwarstwowe background-image (gradient + url) jest
   kruche w arbitrary utility. Warstwy rozmiaru/pozycji ustawia klasa bg-* na elemencie. */
.sq-root {
  background-image: linear-gradient(rgba(4, 2, 12, 0.55), rgba(4, 2, 12, 0.55)),
    url('/images/backdrop.png');
}
</style>
