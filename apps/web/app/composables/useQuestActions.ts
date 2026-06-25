import { client, type Quest, type CompleteResult } from '~/lib/api-client';

// Solo Leveling rank colours, E (weakest) → S (strongest). Single source so the
// list card and the detail view stay in sync.
export const RANK_COLORS: Record<string, string> = {
  E: '#8a8f98', D: '#3fbf6f', C: '#2f6bff', B: '#9a5bff', A: '#ff9a3c', S: '#ffcf3c',
};

// Complete / delete a quest against the API. Shared by QuestCard (list) and
// QuestDetail (modal) so the fetch + error handling lives in exactly one place.
export function useQuestActions(
  getQuest: () => Quest,
  handlers: { completed: (r: CompleteResult) => void; deleted: (id: string) => void },
) {
  const completing = ref(false);
  const deleting = ref(false);
  const errorMsg = ref<string | null>(null);

  async function onComplete() {
    const quest = getQuest();
    completing.value = true;
    errorMsg.value = null;
    try {
      const res = await client.api.quests[':id'].complete.$post({ param: { id: quest.id } });
      if (!res.ok) {
        errorMsg.value = res.status === 409 ? 'Already completed.' : 'Could not complete quest.';
        return;
      }
      handlers.completed(await res.json());
    } finally {
      completing.value = false;
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
