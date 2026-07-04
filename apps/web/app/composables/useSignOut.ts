import { signOut } from '~/lib/auth-client';

// Sign out, refresh the cached session so the route guard doesn't act on a stale one,
// then redirect to login. Shared by the desktop nav rail (layout) and the Status page.
export function useSignOut() {
  const loggingOut = ref(false);

  async function onSignOut() {
    loggingOut.value = true;
    await signOut();
    await refreshAuthSession();
    await navigateTo('/login');
  }

  return { loggingOut, onSignOut };
}
