import { authClient } from '~/lib/auth-client';

// user carries typed xp/level via inferAdditionalFields<Auth>().
export type SessionData = typeof authClient.$Infer.Session;

export const AUTH_SESSION_KEY = 'auth:session';

// Shared, deduped session fetch used by the guard and pages.
// We avoid authClient.useSession(useFetch) on purpose: it subscribes to a nanostore
// via an effect scope, which doesn't exist in global middleware → leaks into Nuxt's
// useFetch watch and OOMs the SSR render worker.
export function useAuthSession() {
  return useFetch<SessionData | null>('/api/auth/get-session', {
    key: AUTH_SESSION_KEY,
    // SSR: hit the backend's absolute origin — a relative /api fetch is in-process
    // and skips the dev proxy, landing in Nuxt's catch-all (404 → guard recursion → OOM).
    // Client: relative, so the browser stays same-origin.
    baseURL: import.meta.server ? useRuntimeConfig().public.apiBase : undefined,
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
  });
}

// Refresh after sign in/up/out so the guard doesn't act on a stale cached session.
export function refreshAuthSession() {
  return refreshNuxtData(AUTH_SESSION_KEY);
}
