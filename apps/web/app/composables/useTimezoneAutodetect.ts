import type { MaybeRefOrGetter } from 'vue';
import { client } from '~/lib/api-client';
import { browserTimezone } from '~/composables/useUserSettings';

// First-boot timezone detection. The backend judges every calendar day (rituals, streaks,
// DONE TODAY) in `user_settings.timezone`, which falls back to UTC until the user picks a
// zone — so a player who never visited Status was silently living on UTC days. On boot,
// when the server reports the zone is still the default (no settings row), save the
// browser's zone once. A saved choice — including a deliberate 'UTC' — is a row, so
// `isDefault` is false and nothing is touched; the Status selector stays the way to change
// it. Lives in the persistent default layout so it runs once per session, not per page.
export function useTimezoneAutodetect(userId: MaybeRefOrGetter<string | undefined>) {
  onMounted(async () => {
    if (!toValue(userId)) return;
    const detected = browserTimezone();
    if (!detected) return;
    try {
      const res = await client.api.user.settings.$get();
      if (!res.ok) return;
      const settings = await res.json();
      if (!settings.isDefault || settings.timezone === detected) return;
      const saved = await client.api.user.settings.$patch({ json: { timezone: detected } });
      // The Status page may already have fetched the default; hand it the saved zone.
      if (saved.ok) await refreshNuxtData('user-settings');
    } catch {
      // Best effort: a failed detection just leaves the fallback zone until the user picks one.
    }
  });
}
