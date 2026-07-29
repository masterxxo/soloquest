import { initReducedMotion } from '~/composables/useReducedMotion';

// Wire the reduced-motion state (OS setting + persisted "Reduce reward effects" toggle) once,
// app-wide. Deferred to `app:mounted` — i.e. after hydration — because reading the OS setting
// and localStorage any earlier would diverge from the motion-on markup the server rendered and
// warn. Running it here (not in a page) means the `.dl-reduce-motion` class is applied on every
// route, not only after a visit to Status.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => initReducedMotion());
});
