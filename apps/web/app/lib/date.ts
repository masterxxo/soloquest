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

// A relative group of completion-log rows, keyed for :key and titled for its header.
export interface CompletionGroup<T> {
  key: string;
  label: string;
  items: T[];
}

// Groups completion rows (already newest-first) by their user-timezone calendar day, into
// relative buckets: Today / Yesterday / This week (the rest of the last 7 days) / then one
// bucket per calendar month ("June 2026"). Operates only on the safe `completedDate` strings
// the backend computed — no instant-to-day conversion happens here, so no day-boundary
// off-by-one. Insertion order is preserved, so the returned groups already read newest-first.
export function groupByCompletionDate<T extends { completedDate: string }>(
  items: T[],
): CompletionGroup<T>[] {
  const today = localDateString();
  const yesterday = localDateString(new Date(Date.now() - 86_400_000));
  // Inclusive lower edge of "this week": the last 7 calendar days ending today.
  const weekStart = localDateString(new Date(Date.now() - 6 * 86_400_000));

  const classify = (date: string): { key: string; label: string } => {
    if (date === today) return { key: 'today', label: 'Today' };
    if (date === yesterday) return { key: 'yesterday', label: 'Yesterday' };
    // Everything reaching here is older than yesterday (completions are never in the future).
    if (date >= weekStart) return { key: 'this-week', label: 'This week' };
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y!, m! - 1, d!);
    return { key: date.slice(0, 7), label: formatDate(dt, { month: 'long', year: 'numeric' }) };
  };

  const groups = new Map<string, CompletionGroup<T>>();
  for (const item of items) {
    const { key, label } = classify(item.completedDate);
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, label, items: [item] });
  }
  return [...groups.values()];
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
