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
//
// It also owns the list's second filter dimension, `?top=1` ("Hide sub-tasks"), which is a
// different kind of narrowing: it removes no quest from the list, it switches off the
// nested sub-task rendering inside each QuestCard. The two live together because "is any
// filter on" and "Clear" span both — splitting them would mean every caller reassembling
// those two answers by hand.
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

  // Only `?top=1` hides sub-tasks; absent, junk, or `top=0` all mean "show them". Same
  // rule as the ranks — an URL the player can't have meant must degrade to showing more,
  // never to hiding things they'd then have to hunt for.
  const hideSubTasks = computed(() => {
    const raw = route.query.top;
    return (Array.isArray(raw) ? raw[0] : raw) === '1';
  });

  // At least one chip lit. All six lit still counts: it shows the same quests as the
  // default, but it is a state the player built and can Clear back out of. This is what
  // gates the "Showing X of Y" readout — the ranks are the only dimension that moves those
  // two numbers.
  const isRankFiltered = computed(() => selectedRanks.value.length > 0);

  // Any dimension on — what "Clear" hangs off. Broader than isRankFiltered on purpose:
  // hiding sub-tasks is a state worth offering a way out of, even though it narrows no count.
  const isFiltered = computed(() => isRankFiltered.value || hideSubTasks.value);

  // Both dimensions write through here, always from a full picture of the next state, so
  // one can never clobber the other and clearing both stays a single navigation rather than
  // two replace() calls racing over the same query object.
  function writeFilters(next: { ranks: Difficulty[]; hideSubTasks: boolean }) {
    const query = { ...route.query };
    if (!next.ranks.length) delete query.rank; // default → clean URL
    else query.rank = next.ranks.join(',');
    if (!next.hideSubTasks) delete query.top;
    else query.top = '1';
    // replace(), not push(): toggling a chip adjusts the current view, it isn't a place
    // worth walking Back through one chip at a time.
    router.replace({ query });
  }

  function toggleRank(rank: Difficulty) {
    const ranks = isRankSelected(rank)
      ? selectedRanks.value.filter((r) => r !== rank)
      : DIFFICULTY_ORDER.filter((r) => r === rank || isRankSelected(r)); // keep canonical order
    writeFilters({ ranks, hideSubTasks: hideSubTasks.value });
  }

  function toggleSubTasks() {
    writeFilters({ ranks: selectedRanks.value, hideSubTasks: !hideSubTasks.value });
  }

  function clearFilter() {
    writeFilters({ ranks: [], hideSubTasks: false });
  }

  // Narrows a list the caller already holds. Kept generic over `difficulty` so it stays a
  // list filter rather than a quest filter, and left as a plain function: called from the
  // caller's own computed, it tracks the URL through `selectedRanks` like any other read.
  function filterByRank<T extends { difficulty: string }>(list: T[]): T[] {
    if (!selectedRanks.value.length) return list; // nothing lit = no filter
    return list.filter((item) => selectedRankSet.value.has(item.difficulty));
  }

  return {
    selectedRanks,
    isRankSelected,
    isRankFiltered,
    isFiltered,
    hideSubTasks,
    toggleRank,
    toggleSubTasks,
    clearFilter,
    filterByRank,
  };
}
