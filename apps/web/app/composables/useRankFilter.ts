import { DIFFICULTY_ORDER, type Difficulty } from '@soloquest/shared';

// The quest list's rank filter. Purely client-side: it narrows a list the caller already
// holds, it never touches the request.
//
// The state lives in the URL rather than in a ref or a store. Because the address *is*
// the state, this is safe to call from more than one place — the page (to narrow the list
// and to clear from its empty state) and QuestFilterBar (to render the chips) each call
// it and read the same source, so there is nothing to prop-drill and nothing to sync.
//
// A refresh keeps the filter, while a fresh click on `/` from the nav drops it. That
// asymmetry is deliberate: a filter that hides quests must not outlive the address that
// hid them, or the player is left wondering where their quests went. Nothing persists
// between sessions.
//
// Additive: chips start unlit, and lighting one *adds* its rank to what shows. So an
// empty selection is not "hide everything" — it's "no filter yet", the whole board. That
// falls out well in three places: the default state is the clean URL, a junk `rank` value
// degrades to showing every quest instead of to a blank page, and there is no way to
// arrive at an empty list without having lit a chip yourself.
//   (no param)   nothing lit — every quest shows
//   ?rank=D      only D
//   ?rank=D,A    D and A, in DIFFICULTY_ORDER order
export function useRankFilter() {
  const route = useRoute();
  const router = useRouter();

  const selectedRanks = computed<Difficulty[]>(() => {
    const raw = route.query.rank;
    if (raw === undefined) return [];
    const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
    const wanted = new Set(value.split(','));
    // Order comes from DIFFICULTY_ORDER, never from the URL; unrecognised tokens drop out.
    return DIFFICULTY_ORDER.filter((r) => wanted.has(r));
  });

  const selectedRankSet = computed(() => new Set<string>(selectedRanks.value));
  const isRankSelected = (rank: Difficulty) => selectedRankSet.value.has(rank);

  // "Filtered" = at least one chip lit. All six lit still counts: it shows the same quests
  // as the default, but it is a state the player built and can Clear back out of.
  const isFiltered = computed(() => selectedRanks.value.length > 0);

  function writeRanks(next: Difficulty[]) {
    const query = { ...route.query };
    if (!next.length) delete query.rank; // default → clean URL
    else query.rank = next.join(',');
    // replace(), not push(): toggling a chip adjusts the current view, it isn't a place
    // worth walking Back through one chip at a time.
    router.replace({ query });
  }

  function toggleRank(rank: Difficulty) {
    const next = isRankSelected(rank)
      ? selectedRanks.value.filter((r) => r !== rank)
      : DIFFICULTY_ORDER.filter((r) => r === rank || isRankSelected(r)); // keep canonical order
    writeRanks(next);
  }

  function clearFilter() {
    writeRanks([]);
  }

  // Narrows a list the caller already holds. Kept generic over `difficulty` so it stays a
  // list filter rather than a quest filter, and left as a plain function: called from the
  // caller's own computed, it tracks the URL through `selectedRanks` like any other read.
  function filterByRank<T extends { difficulty: string }>(list: T[]): T[] {
    if (!selectedRanks.value.length) return list; // nothing lit = no filter
    return list.filter((item) => selectedRankSet.value.has(item.difficulty));
  }

  return { selectedRanks, isRankSelected, isFiltered, toggleRank, clearFilter, filterByRank };
}
