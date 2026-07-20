import {
  DIFFICULTY_ORDER,
  QUEST_PRIORITY,
  type Difficulty,
  type QuestPriority,
} from '@soloquest/shared';

// The quest list's filters. Purely client-side: they narrow a list the caller already
// holds, they never touch the request.
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
// Additive: chips start unlit, and lighting one *adds* its value to what shows. So an
// empty selection is not "hide everything" — it's "no filter yet", the whole board. That
// falls out well in three places: the default state is the clean URL, a junk value
// degrades to showing every quest instead of to a blank page, and there is no way to
// arrive at an empty list without having lit a chip yourself.
//   (no param)   nothing lit — every quest shows
//   ?rank=D      only D
//   ?rank=D,A    D and A, in DIFFICULTY_ORDER order
//
// It owns every filter dimension of the quest list, so "is any filter on" and "Clear"
// span all of them from one place (splitting would make every caller reassemble the answer):
//   - `?rank=<r>,<r>` — an OR filter over quest rank.
//   - `?priority=<p>,<p>` — an OR filter over quest priority (high/normal/low). Same additive
//     rule as the ranks; empty = no priority filter.
//   - `?tags=<id>,<id>` — an OR filter over the quest's pinned tags: a quest shows if it
//     carries ANY selected tag. Empty selection = no tag filter.
//   - `?top=1` ("Hide sub-tasks") — a different kind of narrowing: it removes no quest from
//     the list, it switches off the nested sub-task rendering inside each QuestCard.
// The count dimensions (rank, priority, tags) are combined by AND; each is internally OR.
export function useQuestFilters() {
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

  // Selected priorities from `?priority=high,low`. Same rules as the ranks: canonical order
  // comes from QUEST_PRIORITY (never the URL), unknown tokens drop out, empty = no filter.
  const selectedPriorities = computed<QuestPriority[]>(() => {
    const raw = route.query.priority;
    if (raw === undefined) return [];
    const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
    const wanted = new Set(value.split(','));
    return QUEST_PRIORITY.filter((p) => wanted.has(p));
  });

  const selectedPrioritySet = computed(() => new Set<string>(selectedPriorities.value));
  const isPrioritySelected = (priority: QuestPriority) => selectedPrioritySet.value.has(priority);
  const isPriorityFiltered = computed(() => selectedPriorities.value.length > 0);

  // Only `?top=1` hides sub-tasks; absent, junk, or `top=0` all mean "show them". Same
  // rule as the ranks — an URL the player can't have meant must degrade to showing more,
  // never to hiding things they'd then have to hunt for.
  const hideSubTasks = computed(() => {
    const raw = route.query.top;
    return (Array.isArray(raw) ? raw[0] : raw) === '1';
  });

  // Selected tag ids from `?tags=<id>,<id>`. Kept as raw ids (order as written, deduped);
  // unlike the ranks there is no canonical order to impose, and an unknown id simply matches
  // nothing rather than breaking the list.
  const selectedTagIds = computed<string[]>(() => {
    const raw = route.query.tags;
    if (raw === undefined) return [];
    const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
    return [...new Set(value.split(',').filter(Boolean))];
  });

  const selectedTagIdSet = computed(() => new Set(selectedTagIds.value));
  const isTagSelected = (id: string) => selectedTagIdSet.value.has(id);
  const isTagFiltered = computed(() => selectedTagIds.value.length > 0);

  // At least one rank chip lit. All six lit still counts: it shows the same quests as the
  // default, but it is a state the player built and can Clear back out of. This (with the
  // other count dimensions) gates the "Showing X of Y" readout.
  const isRankFiltered = computed(() => selectedRanks.value.length > 0);

  // Dimensions that actually narrow the quest count (ranks + priority + tags), so they feed
  // the "Showing X of Y" readout. Hiding sub-tasks is excluded on purpose — it removes no
  // top-level quest, so it moves no count.
  const isCountFiltered = computed(
    () => isRankFiltered.value || isPriorityFiltered.value || isTagFiltered.value,
  );

  // Any dimension on — what "Clear" hangs off. Broader than isCountFiltered on purpose:
  // hiding sub-tasks is a state worth offering a way out of, even though it narrows no count.
  const isFiltered = computed(() => isCountFiltered.value || hideSubTasks.value);

  // Every dimension writes through here, always from a full picture of the next state, so
  // one can never clobber another and clearing all stays a single navigation rather than
  // several replace() calls racing over the same query object.
  function writeFilters(next: {
    ranks: Difficulty[];
    priorities: QuestPriority[];
    tagIds: string[];
    hideSubTasks: boolean;
  }) {
    const query = { ...route.query };
    if (!next.ranks.length) delete query.rank; // default → clean URL
    else query.rank = next.ranks.join(',');
    if (!next.priorities.length) delete query.priority;
    else query.priority = next.priorities.join(',');
    if (!next.tagIds.length) delete query.tags;
    else query.tags = next.tagIds.join(',');
    if (!next.hideSubTasks) delete query.top;
    else query.top = '1';
    // replace(), not push(): toggling a chip adjusts the current view, it isn't a place
    // worth walking Back through one chip at a time.
    router.replace({ query });
  }

  function currentState() {
    return {
      ranks: selectedRanks.value,
      priorities: selectedPriorities.value,
      tagIds: selectedTagIds.value,
      hideSubTasks: hideSubTasks.value,
    };
  }

  function toggleRank(rank: Difficulty) {
    const ranks = isRankSelected(rank)
      ? selectedRanks.value.filter((r) => r !== rank)
      : DIFFICULTY_ORDER.filter((r) => r === rank || isRankSelected(r)); // keep canonical order
    writeFilters({ ...currentState(), ranks });
  }

  function togglePriority(priority: QuestPriority) {
    const priorities = isPrioritySelected(priority)
      ? selectedPriorities.value.filter((p) => p !== priority)
      : QUEST_PRIORITY.filter((p) => p === priority || isPrioritySelected(p)); // canonical order
    writeFilters({ ...currentState(), priorities });
  }

  function toggleTag(id: string) {
    const tagIds = isTagSelected(id)
      ? selectedTagIds.value.filter((t) => t !== id)
      : [...selectedTagIds.value, id];
    writeFilters({ ...currentState(), tagIds });
  }

  function toggleSubTasks() {
    writeFilters({ ...currentState(), hideSubTasks: !hideSubTasks.value });
  }

  function clearFilter() {
    writeFilters({ ranks: [], priorities: [], tagIds: [], hideSubTasks: false });
  }

  // Drop any `?tags=` id that isn't a real tag (e.g. a tag deleted while its id lingered in a
  // bookmarked URL) so the player can't get stuck on an empty list filtered by an invisible,
  // unnameable tag. Caller passes the set of known tag ids once its tags have loaded — until
  // then this must not run, or it would wipe valid ids before the list arrives.
  function pruneUnknownTags(knownIds: Set<string>) {
    const kept = selectedTagIds.value.filter((id) => knownIds.has(id));
    if (kept.length !== selectedTagIds.value.length) {
      writeFilters({ ...currentState(), tagIds: kept });
    }
  }

  // Narrows a list the caller already holds by the count dimensions (rank AND priority AND
  // tags). Kept generic over the shape it reads (`difficulty`, `priority`, `tags`) so it
  // stays a list filter, and left a plain function: called from the caller's own computed, it
  // tracks the URL through the `selected*` reads like any other reactive dependency.
  function filterQuests<T extends { difficulty: string; priority: string; tags?: { id: string }[] }>(
    list: T[],
  ): T[] {
    let out = list;
    if (selectedRanks.value.length) {
      out = out.filter((item) => selectedRankSet.value.has(item.difficulty));
    }
    if (selectedPriorities.value.length) {
      out = out.filter((item) => selectedPrioritySet.value.has(item.priority));
    }
    if (selectedTagIds.value.length) {
      // OR within tags: keep a quest if it carries ANY selected tag.
      out = out.filter((item) => (item.tags ?? []).some((t) => selectedTagIdSet.value.has(t.id)));
    }
    return out;
  }

  return {
    selectedRanks,
    isRankSelected,
    isRankFiltered,
    selectedPriorities,
    isPrioritySelected,
    isPriorityFiltered,
    togglePriority,
    selectedTagIds,
    isTagSelected,
    isTagFiltered,
    isCountFiltered,
    isFiltered,
    hideSubTasks,
    toggleRank,
    toggleTag,
    toggleSubTasks,
    clearFilter,
    pruneUnknownTags,
    filterQuests,
  };
}
