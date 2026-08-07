import { signOut } from '~/lib/auth-client';
import { clearListCaches } from '~/lib/list-cache';
import { useQuestsStore } from '~/stores/quests';
import { useTagsStore } from '~/stores/tags';

// Sign out, refresh the cached session so the route guard doesn't act on a stale one,
// then redirect to login. Shared by the desktop nav rail (layout) and the Status page.
export function useSignOut() {
  const loggingOut = ref(false);
  const { data: session } = useAuthSession();

  async function onSignOut() {
    loggingOut.value = true;
    const userId = session.value?.user?.id;
    if (userId) clearListCaches(userId);
    useQuestsStore().reset();
    useTagsStore().reset();
    await signOut();
    await refreshAuthSession();
    await navigateTo('/login');
  }

  return { loggingOut, onSignOut };
}
