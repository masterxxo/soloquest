import type { MaybeRefOrGetter } from 'vue';
import { useQuestsStore } from '~/stores/quests';
import { useTagsStore } from '~/stores/tags';
import {
  LIST_CACHE_TTL_MS,
  LIST_CACHE_VISIBILITY_MAX_AGE_MS,
} from '~/lib/list-cache';

// Boots the per-user list stores (hydrate from localStorage + always revalidate), then keeps
// them fresh: a 5-minute interval while the tab is open, and a quicker refresh when the tab
// becomes visible again after being hidden. Lives in the persistent default layout so one
// timer covers Quests / Rituals / Status / Chronicles.
export function useListCacheSync(userId: MaybeRefOrGetter<string | undefined>) {
  const quests = useQuestsStore();
  const tags = useTagsStore();

  let intervalId: ReturnType<typeof setInterval> | undefined;

  function refreshStale(maxAgeMs?: number) {
    void quests.refreshIfStale(maxAgeMs);
    void tags.refreshIfStale(maxAgeMs);
  }

  function onVisibility() {
    if (document.visibilityState !== 'visible') return;
    refreshStale(LIST_CACHE_VISIBILITY_MAX_AGE_MS);
  }

  onMounted(() => {
    const id = toValue(userId);
    if (!id) return;
    void quests.boot(id);
    void tags.boot(id);
    intervalId = setInterval(() => refreshStale(), LIST_CACHE_TTL_MS);
    document.addEventListener('visibilitychange', onVisibility);
  });

  onUnmounted(() => {
    if (intervalId != null) clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibility);
  });
}
