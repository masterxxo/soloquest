import {
  client,
  type RecurringQuestWithStreak,
  type RecurringCompleteResult,
  type Achievement,
} from '~/lib/api-client';
import { localDateString } from '~/lib/date';

// Complete / delete a recurring quest ("ritual") against the API. Shared by
// RecurringQuestCard (list) and RecurringQuestDetail (modal) so the fetch + error
// handling lives in exactly one place. Mirrors useQuestActions for one-off quests.
export function useRecurringQuestActions(
  getQuest: () => RecurringQuestWithStreak,
  handlers: {
    completed: (r: RecurringCompleteResult) => void;
    deleted: (id: string) => void;
    achievementsEarned: (a: Achievement[]) => void;
  },
) {
  const completing = ref(false);
  const deleting = ref(false);
  const errorMsg = ref<string | null>(null);

  async function onComplete() {
    const quest = getQuest();
    completing.value = true;
    errorMsg.value = null;
    try {
      const res = await client.api['recurring-quests'][':id'].complete.$post({
        param: { id: quest.id },
        json: { completedDate: localDateString() },
      });
      if (!res.ok) {
        errorMsg.value =
          res.status === 409 ? 'Already completed today.' : 'Could not complete quest.';
        return;
      }
      const result = await res.json();
      handlers.completed(result);
      // Surface any freshly-crossed achievements so the page can toast them.
      if (result.newAchievements.length > 0) handlers.achievementsEarned(result.newAchievements);
    } finally {
      completing.value = false;
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
        errorMsg.value = 'Could not delete quest.';
        return;
      }
      handlers.deleted(quest.id);
    } finally {
      deleting.value = false;
    }
  }

  return { completing, deleting, errorMsg, onComplete, onDelete };
}
