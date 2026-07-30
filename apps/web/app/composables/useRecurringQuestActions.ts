import {
  client,
  type RecurringQuestWithStreak,
  type RecurringCompleteResult,
  type Achievement,
} from '~/lib/api-client';
import { readApiError } from '~/lib/api-error';
import { localDateString } from '~/lib/date';
import { useQuestsStore } from '~/stores/quests';
import { useFeedbackStore } from '~/stores/feedback';
import { usePlayerStore } from '~/stores/player';

// Complete / delete a recurring quest ("ritual") against the API. Shared by
// RecurringQuestCard (list) and RecurringQuestDetail (modal) so the fetch + error
// handling lives in exactly one place. Mirrors useQuestActions for one-off quests.
export function useRecurringQuestActions(
  getQuest: () => RecurringQuestWithStreak,
  handlers: {
    completed: (r: RecurringCompleteResult) => void;
    deleted: (id: string) => void;
    achievementsEarned: (a: Achievement[]) => void;
    // Called only from the detail modal's heatmap (the card has no backfill surface).
    // `result` is undefined on the 409 path — the caller should just refetch its view.
    backfilled?: (result?: RecurringCompleteResult) => void | Promise<void>;
  },
) {
  const quests = useQuestsStore();
  const feedback = useFeedbackStore();
  const player = usePlayerStore();

  // Derived from the store, so both this ritual's card and its open detail modal reflect
  // the same in-flight request instead of tracking it once per component.
  const completing = computed(() => quests.isCompleting('recurring', getQuest().id));
  const deleting = ref(false);
  const errorMsg = ref<string | null>(null);
  // Which past day (if any) is currently being backfilled — lets the heatmap show the
  // in-flight cell without a second per-cell flag.
  const backfillingDate = ref<string | null>(null);

  async function onComplete() {
    const quest = getQuest();
    // Claims the id, or bails out if a request for this ritual is already in flight.
    if (!quests.beginComplete('recurring', quest.id)) return;
    errorMsg.value = null;
    try {
      const res = await client.api['recurring-quests'][':id'].complete.$post({
        param: { id: quest.id },
        json: { completedDate: localDateString() },
      });

      // Already completed today (a second tab, or a request that raced this one). Not an
      // error the player caused: state the fact, and refetch so the card settles on the
      // truth from the server ("Done today") instead of guessing at it locally.
      //
      // The XP for that completion *was* granted — just not to this session — so the
      // player's xp/level are refreshed too. Skipping that is what makes the UI look
      // consistent while being wrong: card flips to done, kartusz keeps a stale level.
      if (res.status === 409) {
        feedback.showInfo('Already completed today.');
        await Promise.all([quests.refreshRecurring(), player.refreshFromSession()]);
        return;
      }

      if (!res.ok) {
        const { message } = await readApiError(res, 'Could not complete ritual.');
        errorMsg.value = message;
        feedback.showError(message);
        return;
      }

      const result = await res.json();
      handlers.completed(result);
      // Surface any freshly-crossed achievements so the page can toast them.
      if (result.newAchievements.length > 0) handlers.achievementsEarned(result.newAchievements);
    } finally {
      // Always released — a failed request must not leave the button disabled forever.
      quests.endComplete('recurring', quest.id);
    }
  }

  // Backfill a due-but-missed past day from the heatmap. Same endpoint, atomic path and
  // in-flight guard as onComplete — just a different date. On success the caller (the
  // detail modal) folds in the streak/player result and refetches the calendar so the
  // cell flips to "done".
  async function onBackfill(date: string) {
    const quest = getQuest();
    if (!quests.beginComplete('recurring', quest.id)) return;
    backfillingDate.value = date;
    errorMsg.value = null;
    try {
      const res = await client.api['recurring-quests'][':id'].complete.$post({
        param: { id: quest.id },
        json: { completedDate: date },
      });

      // Already recorded (a second tab/device, or a double click that raced this one). Not
      // an error the player caused: state it, and refetch so the view settles on the truth.
      // The XP for that completion was granted — just not here — so refresh player state too.
      if (res.status === 409) {
        feedback.showInfo('That day is already completed.');
        await Promise.all([quests.refreshRecurring(), player.refreshFromSession()]);
        await handlers.backfilled?.();
        return;
      }

      if (!res.ok) {
        const { message } = await readApiError(res, 'Could not complete that day.');
        errorMsg.value = message;
        feedback.showError(message);
        return;
      }

      const result = await res.json();
      await handlers.backfilled?.(result);
      if (result.newAchievements.length > 0) handlers.achievementsEarned(result.newAchievements);
    } finally {
      backfillingDate.value = null;
      quests.endComplete('recurring', quest.id);
    }
  }

  async function onDelete() {
    const quest = getQuest();
    if (!confirm(`Delete ritual "${quest.title}"?`)) return;
    deleting.value = true;
    errorMsg.value = null;
    try {
      const res = await client.api['recurring-quests'][':id'].$delete({ param: { id: quest.id } });
      if (!res.ok) {
        errorMsg.value = (await readApiError(res, 'Could not delete ritual.')).message;
        return;
      }
      handlers.deleted(quest.id);
    } finally {
      deleting.value = false;
    }
  }

  return { completing, deleting, errorMsg, backfillingDate, onComplete, onBackfill, onDelete };
}
