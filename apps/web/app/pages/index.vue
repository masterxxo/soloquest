<script setup lang="ts">
import { storeToRefs } from 'pinia';
import {
  client,
  type Quest,
  type QuestWithWarnings,
  type CompleteResult,
} from '~/lib/api-client';
import { useQuestsStore } from '~/stores/quests';

const quests = useQuestsStore();
const { activeQuests } = storeToRefs(quests);

// Counts/lists come from the shared store; the layout already loaded them, but calling
// load() here too makes the page safe to hit directly (it self-guards re-fetches).
onMounted(() => { quests.load(); });

// ── Quick-add ─────────────────────────────────────────────────────────────────
// A title-only capture: posts an E-rank quest (description mirrors the title) so it
// lands in STANDING ORDERS immediately. The full form is one click away for details.
const quickTitle = ref('');
const quickAdding = ref(false);
async function quickAdd() {
  const title = quickTitle.value.trim();
  if (!title || quickAdding.value) return;
  quickAdding.value = true;
  try {
    const res = await client.api.quests.$post({
      json: { title, description: title, difficulty: 'E', deadline: null },
    });
    if (!res.ok) return;
    quests.addQuest(await res.json());
    quickTitle.value = '';
  } finally {
    quickAdding.value = false;
  }
}

// ── New-quest form (full) ───────────────────────────────────────────────────────
const showNewQuestForm = ref(false);
const newQuestOrigin = ref<{ x: number; y: number } | null>(null);
function openNewQuestForm(event?: MouseEvent) {
  newQuestOrigin.value = originFrom(event);
  showNewQuestForm.value = true;
}
function onCreated(result: QuestWithWarnings) {
  quests.addQuest(result);
  showNewQuestForm.value = false;
}

// ── Quest detail ────────────────────────────────────────────────────────────────
const selectedQuest = ref<Quest | null>(null);
const questDetailOrigin = ref<{ x: number; y: number } | null>(null);
function openQuestDetail(quest: Quest, event?: MouseEvent) {
  questDetailOrigin.value = originFrom(event);
  selectedQuest.value = quest;
}

function onCompleted(result: CompleteResult) {
  quests.applyCompleted(result);
}
function onDeleted(id: string) {
  quests.removeQuest(id);
}
function onUpdated(result: QuestWithWarnings) {
  quests.applyUpdated(result);
  if (selectedQuest.value?.id === result.quest.id)
    selectedQuest.value = { ...selectedQuest.value, ...result.quest };
}
function onDetailCompleted(result: CompleteResult) {
  onCompleted(result);
  selectedQuest.value = null;
}
function onDetailDeleted(id: string) {
  onDeleted(id);
  selectedQuest.value = null;
}

// Viewport point a modal grows out of — the centre of the element that opened it.
function originFrom(event?: MouseEvent): { x: number; y: number } | null {
  const el = event?.currentTarget;
  if (el instanceof HTMLElement) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return null;
}

// ── Grouping by deadline ────────────────────────────────────────────────────────
type QuestGroup = {
  key: string; // "overdue" | "YYYY-MM-DD" | "standing"
  label: string;
  isOverdue: boolean;
  quests: Quest[];
};

// Local YYYY-MM-DD key (not toISOString — that would shift by the UTC offset).
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const questGroups = computed<QuestGroup[]>(() => {
  // Only top-level quests; sub-tasks render nested inside their parent's QuestCard.
  const list = (activeQuests.value ?? []).filter((q) => q.parentId == null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);

  let overdue: Quest[] | null = null;
  let standing: Quest[] | null = null;
  const dated = new Map<string, Quest[]>();

  for (const q of list) {
    if (!q.deadline) {
      (standing ??= []).push(q);
      continue;
    }
    const d = new Date(q.deadline);
    if (d < today) {
      (overdue ??= []).push(q);
    } else {
      const key = dateKey(d);
      const bucket = dated.get(key);
      if (bucket) bucket.push(q);
      else dated.set(key, [q]);
    }
  }

  const groups: QuestGroup[] = [];

  if (overdue) {
    overdue.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    groups.push({ key: 'overdue', label: 'OVERDUE', isOverdue: true, quests: overdue });
  }

  for (const key of [...dated.keys()].sort()) {
    const bucket = dated.get(key)!;
    bucket.sort((a, b) => a.title.localeCompare(b.title));
    const [y, m, day] = key.split('-').map(Number);
    const d = new Date(y!, m! - 1, day!);
    const datePart = d
      .toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
      .toUpperCase();
    const weekday = d.toLocaleDateString('pl-PL', { weekday: 'long' }).toUpperCase();
    const label =
      key === todayKey ? `TODAY · ${datePart} · ${weekday}` : `${datePart} · ${weekday}`;
    groups.push({ key, label, isOverdue: false, quests: bucket });
  }

  if (standing) {
    standing.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    groups.push({ key: 'standing', label: 'STANDING ORDERS', isOverdue: false, quests: standing });
  }

  return groups;
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1 class="page-title">Quests</h1>
      <form class="quick-add" @submit.prevent="quickAdd">
        <input
          v-model="quickTitle"
          type="text"
          class="quick-input"
          placeholder="Quick add a quest…"
          maxlength="255"
        />
        <button type="submit" class="quick-btn" :disabled="quickAdding || !quickTitle.trim()">
          Add
        </button>
        <button type="button" class="hdr-btn" @click="openNewQuestForm">+ New Quest</button>
      </form>
    </header>

    <div class="quest-groups">
      <section v-for="group in questGroups" :key="group.key" class="quest-group">
        <div class="group-header" :class="{ 'group-header--overdue': group.isOverdue }">
          {{ group.label }}
        </div>
        <div class="group-quests">
          <QuestCard
            v-for="q in group.quests"
            :key="q.id"
            :quest="q"
            selectable
            :campaign-name="quests.campaignName(q.campaignId)"
            @open="openQuestDetail"
            @completed="onCompleted"
            @deleted="onDeleted"
            @updated="onUpdated"
          />
        </div>
      </section>
      <p v-if="!questGroups.length" class="hint">No active quests. Add your first above.</p>
    </div>

    <!-- New-quest form modal. -->
    <HubPanel
      v-if="showNewQuestForm"
      title="New Quest"
      :origin="newQuestOrigin"
      @close="showNewQuestForm = false"
    >
      <QuestForm mode="create" @created="onCreated" />
    </HubPanel>

    <!-- Single-quest detail — wide two-pane modal. -->
    <HubPanel
      v-if="selectedQuest"
      title="Quest"
      :origin="questDetailOrigin"
      :max-width="980"
      @close="selectedQuest = null"
    >
      <QuestDetail
        :quest="selectedQuest"
        :campaign-name="quests.campaignName(selectedQuest.campaignId)"
        @completed="onDetailCompleted"
        @deleted="onDetailDeleted"
        @updated="onUpdated"
      />
    </HubPanel>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 1.25rem; }
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.page-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #efeaff;
}
.quick-add { display: flex; align-items: center; gap: 0.5rem; }
.quick-input {
  background: rgba(14, 9, 30, 0.7);
  border: 1px solid #2a2050;
  color: #ece8fb;
  font: inherit;
  font-size: 0.85rem;
  padding: 0.4rem 0.7rem;
  min-width: 200px;
}
.quick-input:focus { outline: none; border-color: #7c5ce8; }
.quick-btn,
.hdr-btn {
  background: transparent;
  border: 1px solid #2a2050;
  color: #d0c8f8;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
}
.quick-btn { border-color: #7c5ce8; background: rgba(124, 92, 232, 0.12); }
.quick-btn:hover:not(:disabled),
.hdr-btn:hover { border-color: #7c5ce8; }
.quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.quest-groups { display: flex; flex-direction: column; gap: 1.25rem; }
.quest-group { display: flex; flex-direction: column; gap: 0.5rem; }
.group-header {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #4a3d7a;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid rgba(74, 61, 122, 0.3);
}
.group-header--overdue { color: #c0543a; border-bottom-color: rgba(192, 84, 58, 0.3); }
.group-quests { display: flex; flex-direction: column; gap: 0.5rem; }
.hint { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
</style>
