import { client, type Quest, type CompleteResult } from '~/lib/api-client';
import { readApiError } from '~/lib/api-error';
import { useQuestsStore } from '~/stores/quests';
import { useFeedbackStore } from '~/stores/feedback';
import { usePlayerStore } from '~/stores/player';

// Complete / delete a quest against the API. Shared by QuestCard (list) and
// QuestDetail (modal) so the fetch + error handling lives in exactly one place.
export function useQuestActions(
  getQuest: () => Quest,
  handlers: { completed: (r: CompleteResult) => void; deleted: (id: string) => void },
) {
  const quests = useQuestsStore();
  const feedback = useFeedbackStore();
  const player = usePlayerStore();

  // Derived from the store, so both this quest's card and its open detail modal reflect
  // the same in-flight request instead of tracking it once per component.
  const completing = computed(() => quests.isCompleting('quest', getQuest().id));
  const deleting = ref(false);
  const errorMsg = ref<string | null>(null);

  async function onComplete() {
    const quest = getQuest();
    // Claims the id, or bails out if a request for this quest is already in flight — a
    // second one would grant its XP twice.
    if (!quests.beginComplete('quest', quest.id)) return;
    errorMsg.value = null;
    try {
      const res = await client.api.quests[':id'].complete.$post({ param: { id: quest.id } });

      // Already completed (a second tab, or a request that raced this one) — a statement
      // of fact, not the player's mistake. The quest is no longer active, so it leaves the
      // list exactly as a deleted one does: `deleted` is the handler both callers already
      // map to "drop this id" (and close an open detail).
      //
      // Its XP *was* granted, just not to this session, so pull the player's xp/level back
      // in step with the server — otherwise the quest vanishes and the kartusz stays stale.
      if (res.status === 409) {
        feedback.showInfo('Quest already completed.');
        handlers.deleted(quest.id);
        await player.refreshFromSession();
        return;
      }

      if (!res.ok) {
        const { message } = await readApiError(res, 'Could not complete quest.');
        errorMsg.value = message;
        feedback.showNotice([message], 'warning');
        return;
      }

      handlers.completed(await res.json());
    } finally {
      // Always released — a failed request must not leave the button disabled forever.
      quests.endComplete('quest', quest.id);
    }
  }

  async function onDelete() {
    const quest = getQuest();
    if (!confirm(`Delete quest "${quest.title}"?`)) return;
    deleting.value = true;
    errorMsg.value = null;
    try {
      const res = await client.api.quests[':id'].$delete({ param: { id: quest.id } });
      if (!res.ok) {
        errorMsg.value = (await readApiError(res, 'Could not delete quest.')).message;
        return;
      }
      handlers.deleted(quest.id);
    } finally {
      deleting.value = false;
    }
  }

  return { completing, deleting, errorMsg, onComplete, onDelete };
}
