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

// Human-readable date label in the client's default locale. Single source so every
// deadline/created label formats the same way (no per-call hardcoded locale).
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, options);
}

// Deadline buckets for a list of deadline-bearing items, split by the client's local
// day: past deadlines are `overdue`, today/future ones land in `dated` keyed by their
// local YYYY-MM-DD, and items with no deadline go to `standing`. Shared by the quest
// list grouping (index page) and the today/overdue counters (player store).
export interface DeadlineBuckets<T> {
  overdue: T[];
  dated: Map<string, T[]>;
  standing: T[];
}

export function bucketByDeadline<T extends { deadline?: string | Date | null }>(
  items: T[],
): DeadlineBuckets<T> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue: T[] = [];
  const standing: T[] = [];
  const dated = new Map<string, T[]>();

  for (const item of items) {
    if (!item.deadline) {
      standing.push(item);
      continue;
    }
    const d = new Date(item.deadline);
    if (d < today) {
      overdue.push(item);
    } else {
      const key = localDateString(d);
      const bucket = dated.get(key);
      if (bucket) bucket.push(item);
      else dated.set(key, [item]);
    }
  }

  return { overdue, dated, standing };
}
