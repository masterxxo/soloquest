// Today's date in the CLIENT's local timezone as YYYY-MM-DD — never UTC, so the
// value lands on the user's own calendar day (matches the backend's timezone logic).
// Single source of truth for "which calendar day is it for this user", used both to
// stamp completions and to detect a day-boundary crossing for cache invalidation.
export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
