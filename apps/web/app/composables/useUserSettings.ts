import { client, type UserSettings } from '~/lib/api-client';

// Krótka lista awaryjna, gdyby `Intl.supportedValuesOf` było niedostępne (stare
// środowiska). UTC zawsze na początku — to domyślna strefa serwera.
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

// Pełna lista stref IANA z przeglądarki (fallback na krótką listę powyżej).
function supportedTimezones(): string[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    try {
      const zones = supportedValuesOf('timeZone');
      // Niektóre przeglądarki pomijają UTC na liście — dopilnuj, że zawsze jest.
      return zones.includes('UTC') ? zones : ['UTC', ...zones];
    } catch {
      /* niżej — fallback */
    }
  }
  return FALLBACK_TIMEZONES;
}

// Aktualny offset dla danej strefy (np. `UTC+02:00`), liczony dla „teraz", więc
// odzwierciedla aktualny czas letni/zimowy. GMT → UTC dla spójnego wyglądu.
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

// Data layer + zapis strefy czasowej użytkownika, po stronie klienta (RPC).
// Na razie używa tego wyłącznie strona Status, więc trzymamy to lokalnie w composable
// zamiast rozbudowywać osobny store.
export function useUserSettings() {
  const timezone = ref('UTC');
  const loadError = ref(false);
  const saving = ref(false);
  const saveError = ref<string | null>(null);
  const justSaved = ref(false);

  // Wczytanie ustawień — wyłącznie client-side (zgodnie z architekturą; cookie sesji
  // jedzie z żądaniem same-origin). Błąd nie wywala strony: zostaje domyślne UTC.
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

  // Zapis od razu przy zmianie: optymistycznie aktualizuje UI, wysyła PATCH,
  // a przy błędzie cofa do poprzedniej wartości. Kontrolka zablokowana przez `saving`,
  // więc nie polecą dwa żądania naraz.
  async function setTimezone(next: string) {
    if (next === timezone.value || saving.value) return;
    const previous = timezone.value;
    timezone.value = next; // optymistycznie
    saving.value = true;
    saveError.value = null;
    try {
      const res = await client.api.user.settings.$patch({ json: { timezone: next } });
      if (!res.ok) {
        timezone.value = previous; // cofnięcie
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
      timezone.value = previous; // cofnięcie przy błędzie sieci
      saveError.value = 'Could not save timezone. Please try again.';
    } finally {
      saving.value = false;
    }
  }

  // Podpowiedź z przeglądarki — zapis jak przy każdej innej zmianie.
  function detect() {
    const browserTz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz) setTimezone(browserTz);
  }

  // Lista stref w selektorze — z gwarancją, że bieżąca wartość jest na liście
  // (np. strefa zapisana wcześniej, a nieznana bieżącej przeglądarce).
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
