import { ref, computed } from 'vue';

// Effective "motion is off" for the step-4 reward animations. Two independent switches,
// EITHER of which disables motion:
//   1. the OS  `prefers-reduced-motion: reduce`
//   2. the app "Reduce reward effects" toggle (Status) — persisted in localStorage and
//      mirrored onto `<html class="dl-reduce-motion">` for the global CSS guard in tokens.css.
//
// Every reward animation asks THIS composable, never a media query directly, so the two
// switches live in one place and always agree. When it reports `reduced`, an animation must
// degrade to an INSTANT state change — the final state, no tween — never merely a faster
// tween. The reward stays readable through colour, shape and typography, not motion.

const STORAGE_KEY = 'dl-reduce-motion';
const HTML_CLASS = 'dl-reduce-motion';

// Module singletons: one matchMedia listener and one shared reactive state for every caller.
// Only ever mutated on the client (guarded below), so on the server they stay motion-on for
// everyone — no cross-request leakage of a per-user value.
const systemReduced = ref(false);
const appReduced = ref(false);
let initialized = false;

function syncHtmlClass() {
  document.documentElement.classList.toggle(HTML_CLASS, appReduced.value);
}

// Read the OS setting + persisted toggle and wire live listeners. Idempotent, client-only.
// Deferred to after hydration (called from the `.client` plugin on `app:mounted`) so the
// initial client render still matches the motion-on markup the server sent.
export function initReducedMotion() {
  if (initialized || !import.meta.client) return;
  initialized = true;

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  systemReduced.value = mq.matches;
  mq.addEventListener('change', (e) => {
    systemReduced.value = e.matches;
  });

  appReduced.value = localStorage.getItem(STORAGE_KEY) === '1';
  syncHtmlClass();

  // Keep the app toggle in step across tabs.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      appReduced.value = e.newValue === '1';
      syncHtmlClass();
    }
  });
}

export function useReducedMotion() {
  // The app toggle, writable — the Status control binds to this, so the single source of
  // truth for "reduce reward effects" is here, not a page-local ref. The setter persists and
  // stamps the `<html>` class the global CSS guard reads.
  const reduceEffects = computed({
    get: () => appReduced.value,
    set: (value: boolean) => {
      appReduced.value = value;
      if (!import.meta.client) return;
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      syncHtmlClass();
    },
  });

  // The effective gate every animation reads: system OR app.
  const reduced = computed(() => systemReduced.value || appReduced.value);

  return { reduced, reduceEffects, systemReduced };
}
