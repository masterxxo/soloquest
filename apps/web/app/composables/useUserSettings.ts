import { client, type UserSettings } from '~/lib/api-client';

// Short fallback list for when `Intl.supportedValuesOf` is unavailable (older
// environments). UTC always first — it's the server's default timezone.
const FALLBACK_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Warsaw',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// Full IANA timezone list from the browser (falls back to the short list above).
function supportedTimezones(): string[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    try {
      const zones = supportedValuesOf('timeZone');
      // Some browsers omit UTC from the list — make sure it's always present.
      return zones.includes('UTC') ? zones : ['UTC', ...zones];
    } catch {
      /* fall through to the fallback below */
    }
  }
  return FALLBACK_TIMEZONES;
}

// Current offset for a timezone (e.g. `UTC+02:00`), computed for "now" so it reflects
// the current DST state. GMT → UTC for a consistent look.
function offsetLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    // `GMT` / `GMT+2` → `UTC` / `UTC+2`.
    return raw.replace('GMT', 'UTC') || 'UTC';
  } catch {
    return '';
  }
}

// Data layer + saving of the user's timezone, client-side (RPC). Only the Status page
// uses this for now, so we keep it local to a composable rather than growing a separate
// store.
export function useUserSettings() {
  const timezone = ref('UTC');
  const loadError = ref(false);
  const saving = ref(false);
  const saveError = ref<string | null>(null);
  const justSaved = ref(false);

  // Load settings — client-side only (per the architecture; the session cookie rides
  // along same-origin). An error doesn't break the page: it keeps the default UTC.
  const { pending: loading } = useAsyncData<UserSettings | null>(
    'user-settings',
    async () => {
      loadError.value = false;
      const res = await client.api.user.settings.$get();
      if (!res.ok) {
        loadError.value = true;
        return null;
      }
      const data = await res.json();
      timezone.value = data.timezone ?? 'UTC';
      return data;
    },
    { server: false },
  );

  let savedTimer: ReturnType<typeof setTimeout> | null = null;

  // Save immediately on change: optimistically update the UI, send the PATCH, and roll
  // back to the previous value on error. The control is disabled while `saving`, so two
  // requests can't fire at once.
  async function setTimezone(next: string) {
    if (next === timezone.value || saving.value) return;
    const previous = timezone.value;
    timezone.value = next; // optimistic
    saving.value = true;
    saveError.value = null;
    try {
      const res = await client.api.user.settings.$patch({ json: { timezone: next } });
      if (!res.ok) {
        timezone.value = previous; // roll back
        saveError.value = 'Could not save timezone. Please try again.';
        return;
      }
      const data = await res.json();
      timezone.value = data.timezone ?? next;
      justSaved.value = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        justSaved.value = false;
      }, 2000);
    } catch {
      timezone.value = previous; // roll back on a network error
      saveError.value = 'Could not save timezone. Please try again.';
    } finally {
      saving.value = false;
    }
  }

  // Suggestion from the browser — saved like any other change.
  function detect() {
    const browserTz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz) setTimezone(browserTz);
  }

  // Timezone list for the selector — guaranteed to include the current value (e.g. a
  // zone saved earlier that the current browser doesn't know about).
  const timezones = computed(() => {
    const list = supportedTimezones();
    return list.includes(timezone.value) ? list : [timezone.value, ...list];
  });

  const currentOffset = computed(() => offsetLabel(timezone.value));

  return {
    timezone,
    timezones,
    currentOffset,
    loading,
    loadError,
    saving,
    saveError,
    justSaved,
    setTimezone,
    detect,
  };
}
