<script setup lang="ts">
import { signOut } from '~/lib/auth-client';
import {
  client,
  type Quest,
  type CompleteResult,
  type QuestWithWarnings,
  type Campaign,
  type CampaignDetail,
} from '~/lib/api-client';
import { usePlayerStore } from '~/stores/player';

// Session stays the source of truth; the store is a projection of session.user.
const { data: session } = await useAuthSession();
const player = usePlayerStore();
watchEffect(() => player.hydrate(session.value?.user));

// Quests are fetched CLIENT-SIDE on purpose (per-user, behind login — no SSR benefit,
// and it avoids the server baseURL / hydration quirks of the session fetch).
const { data: activeQuests, pending, error } = await useAsyncData(
  'active-quests',
  async () => {
    const res = await client.api.quests.$get({
      query: { status: 'active', include: 'subTasks' },
    });
    if (!res.ok) throw new Error('Failed to load quests');
    return res.json();
  },
  { server: false, default: () => [] as Quest[] },
);

// Campaigns are fetched client-side too (same per-user, behind-login rationale).
const { data: campaigns } = await useAsyncData(
  'campaigns',
  async () => {
    const res = await client.api.campaigns.$get();
    if (!res.ok) return [];
    return res.json();
  },
  { server: false, default: () => [] as Campaign[] },
);

// null → campaign list view; set → campaign detail view.
const selectedCampaign = ref<CampaignDetail | null>(null);
const campaignLoading = ref(false);

async function openCampaign(id: string) {
  campaignLoading.value = true;
  try {
    const res = await client.api.campaigns[':id'].$get({ param: { id } });
    if (res.ok) selectedCampaign.value = await res.json();
  } finally {
    campaignLoading.value = false;
  }
}
function backToCampaignList() { selectedCampaign.value = null; }

const campaignDeadlineLabel = computed(() =>
  selectedCampaign.value?.deadline
    ? new Date(selectedCampaign.value.deadline).toLocaleDateString()
    : null,
);

const CAMPAIGN_DIFFICULTIES = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

// Resolve a quest's campaignId to a campaign name (from the loaded list) for display.
const campaignNameById = computed(() => {
  const map = new Map<string, string>();
  for (const c of campaigns.value ?? []) map.set(c.id, c.title);
  return map;
});
function campaignName(id: string | null | undefined): string | null {
  return id ? campaignNameById.value.get(id) ?? null : null;
}

// Inline new-campaign form (kept lightweight; quests have their own QuestForm).
const showNewCampaignForm = ref(false);
const campaignTitle = ref('');
const campaignDifficulty = ref<'E' | 'D' | 'C' | 'B' | 'A' | 'S'>('E');
const campaignDescription = ref('');
const campaignDeadline = ref('');
const creatingCampaign = ref(false);

async function createCampaign() {
  creatingCampaign.value = true;
  try {
    const res = await client.api.campaigns.$post({
      json: {
        title: campaignTitle.value,
        difficulty: campaignDifficulty.value,
        description: campaignDescription.value || undefined,
        deadline: campaignDeadline.value ? new Date(campaignDeadline.value) : null,
      },
    });
    if (!res.ok) return;
    const created = await res.json();
    // POST returns the row without questCount; a brand-new campaign has 0 quests.
    campaigns.value = [{ ...created, questCount: 0 }, ...(campaigns.value ?? [])];
    campaignTitle.value = '';
    campaignDifficulty.value = 'E';
    campaignDescription.value = '';
    campaignDeadline.value = '';
    showNewCampaignForm.value = false;
  } finally {
    creatingCampaign.value = false;
  }
}

async function completeCampaign() {
  if (!selectedCampaign.value) return;
  const id = selectedCampaign.value.id;
  const res = await client.api.campaigns[':id'].complete.$post({ param: { id } });
  if (!res.ok) return;
  const updated = await res.json();
  selectedCampaign.value = { ...selectedCampaign.value, status: updated.status, completedAt: updated.completedAt };
  campaigns.value = (campaigns.value ?? []).map((c) =>
    c.id === id ? { ...c, status: updated.status, completedAt: updated.completedAt } : c,
  );
}

// Handlers for the QuestCards shown inside a campaign's detail view. They keep the
// selected campaign's quest list in sync (it's separate from activeQuests).
function onCampaignQuestCompleted(result: CompleteResult) {
  player.applyProgress(result.player);
  if (result.leveledUp) showLevelUp(result.player.level);
  if (!selectedCampaign.value) return;
  selectedCampaign.value = {
    ...selectedCampaign.value,
    quests: selectedCampaign.value.quests.filter((q) => q.id !== result.quest.id),
  };
}
function onCampaignQuestDeleted(id: string) {
  if (!selectedCampaign.value) return;
  selectedCampaign.value = {
    ...selectedCampaign.value,
    quests: selectedCampaign.value.quests.filter((q) => q.id !== id),
  };
}
function onCampaignQuestUpdated(result: QuestWithWarnings) {
  if (result.warnings.length) showWarnings(result.warnings);
  if (!selectedCampaign.value) return;
  selectedCampaign.value = {
    ...selectedCampaign.value,
    // Merge so nested subTasks (absent from the PATCH response) are preserved.
    quests: selectedCampaign.value.quests.map((q) =>
      q.id === result.quest.id ? { ...q, ...result.quest } : q,
    ),
  };
}

// New-quest form is toggled from the Quests panel header (hidden by default).
const showNewQuestForm = ref(false);

function onCreated(result: QuestWithWarnings) {
  activeQuests.value = [result.quest, ...(activeQuests.value ?? [])];
  if (result.warnings.length) showWarnings(result.warnings);
  showNewQuestForm.value = false;
}

function onCompleted(result: CompleteResult) {
  // The quest is now completed → drop it from the active list.
  activeQuests.value = (activeQuests.value ?? []).filter((q) => q.id !== result.quest.id);
  // Single source of player state, updated straight from the server response.
  player.applyProgress(result.player);
  if (result.leveledUp) showLevelUp(result.player.level);
}

function onDeleted(id: string) {
  activeQuests.value = (activeQuests.value ?? []).filter((q) => q.id !== id);
}

function onUpdated(result: QuestWithWarnings) {
  activeQuests.value = (activeQuests.value ?? []).map((q) =>
    q.id === result.quest.id ? result.quest : q,
  );
  if (result.warnings.length) showWarnings(result.warnings);
}

// Group top-level quests into day-sections by deadline: an "overdue" bucket first,
// then dated buckets (soonest → latest), then deadline-less "standing orders" last.
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
  const quests = (activeQuests.value ?? []).filter((q) => q.parentId == null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);

  let overdue: Quest[] | null = null;
  let standing: Quest[] | null = null;
  const dated = new Map<string, Quest[]>();

  for (const q of quests) {
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
    overdue.sort(
      (a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
    );
    groups.push({ key: 'overdue', label: 'OVERDUE', isOverdue: true, quests: overdue });
  }

  for (const key of [...dated.keys()].sort()) {
    const bucket = dated.get(key)!;
    bucket.sort((a, b) => a.title.localeCompare(b.title));
    // key is "YYYY-MM-DD"; build a local date for label formatting.
    const [y, m, day] = key.split('-').map(Number);
    const d = new Date(y!, m! - 1, day!);
    const datePart = d
      .toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
      .toUpperCase();
    const weekday = d.toLocaleDateString('pl-PL', { weekday: 'long' }).toUpperCase();
    const label =
      key === todayKey
        ? `TODAY · ${datePart} · ${weekday}`
        : `${datePart} · ${weekday}`;
    groups.push({ key, label, isOverdue: false, quests: bucket });
  }

  if (standing) {
    standing.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    groups.push({
      key: 'standing',
      label: 'STANDING ORDERS',
      isOverdue: false,
      quests: standing,
    });
  }

  return groups;
});

// Lightweight "System"-style level-up feedback (no engine animations).
const levelUpTo = ref<number | null>(null);
let levelUpTimer: ReturnType<typeof setTimeout> | null = null;
function showLevelUp(level: number) {
  levelUpTo.value = level;
  if (levelUpTimer) clearTimeout(levelUpTimer);
  levelUpTimer = setTimeout(() => { levelUpTo.value = null; }, 3500);
}
// Transient rank-warning toast (server flags quests that out-rank their container).
const rankWarnings = ref<string[]>([]);
let warningsTimer: ReturnType<typeof setTimeout> | null = null;
function showWarnings(warnings: string[]) {
  rankWarnings.value = warnings;
  if (warningsTimer) clearTimeout(warningsTimer);
  warningsTimer = setTimeout(() => { rankWarnings.value = []; }, 4000);
}

onBeforeUnmount(() => {
  if (levelUpTimer) clearTimeout(levelUpTimer);
  if (warningsTimer) clearTimeout(warningsTimer);
});

const loggingOut = ref(false);
async function onSignOut() {
  loggingOut.value = true;
  await signOut();
  await refreshAuthSession();
  await navigateTo('/login');
}

// Which hub panel (if any) is open. Items is intentionally inert (coming later).
type Panel = 'status' | 'quests' | 'campaigns' | 'glossary';
const activePanel = ref<Panel | null>(null);
const PANEL_TITLES: Record<Panel, string> = {
  status: 'Status',
  quests: 'Quests',
  campaigns: 'Campaigns',
  glossary: 'Glossary',
};
const panelTitle = computed(() => (activePanel.value ? PANEL_TITLES[activePanel.value] : ''));

// Viewport point the panel grows out of — the centre of the icon that opened it.
const panelOrigin = ref<{ x: number; y: number } | null>(null);
function openPanel(panel: Panel, event?: MouseEvent) {
  const el = event?.currentTarget;
  if (el instanceof HTMLElement) {
    const r = el.getBoundingClientRect();
    panelOrigin.value = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  } else {
    panelOrigin.value = null;
  }
  activePanel.value = panel;
}
function closePanel() { activePanel.value = null; }

// The new-quest form lives in its own panel, stacked over the Quests panel.
const newQuestOrigin = ref<{ x: number; y: number } | null>(null);
function openNewQuestForm(event?: MouseEvent) {
  const el = event?.currentTarget;
  if (el instanceof HTMLElement) {
    const r = el.getBoundingClientRect();
    newQuestOrigin.value = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  } else {
    newQuestOrigin.value = null;
  }
  showNewQuestForm.value = true;
}

// XP fill for the Status panel bar, clamped to [0, 100].
const xpPercent = computed(() => {
  const { current, needed } = player.progress;
  if (!needed) return 0;
  return Math.min(100, Math.max(0, (current / needed) * 100));
});
</script>

<template>
  <div class="screen">
    <TheTopBar :logging-out="loggingOut" @signout="onSignOut" />

    <HubCharacter />

    <!-- Hub icons -->
    <HubIcon label="Status" x="15%" y="32%" @select="openPanel('status', $event)">
      <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    </HubIcon>

    <HubIcon label="Quests" x="15%" y="62%" @select="openPanel('quests', $event)">
      <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <line x1="8.5" y1="8" x2="15.5" y2="8" />
        <line x1="8.5" y1="12" x2="15.5" y2="12" />
        <line x1="8.5" y1="16" x2="13" y2="16" />
      </svg>
    </HubIcon>

    <HubIcon label="Campaigns" x="85%" y="32%" @select="openPanel('campaigns', $event)">
      <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3l7 2.5V11c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V5.5L12 3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    </HubIcon>

    <HubIcon label="Glossary" x="85%" y="62%" @select="openPanel('glossary', $event)">
      <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 6c-1.5-1.2-3.5-1.8-6-1.8V18c2.5 0 4.5.6 6 1.8" />
        <path d="M12 6c1.5-1.2 3.5-1.8 6-1.8V18c-2.5 0-4.5.6-6 1.8" />
        <line x1="12" y1="6" x2="12" y2="19.8" />
      </svg>
    </HubIcon>

    <HubIcon label="Items" x="50%" y="90%" disabled>
      <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3l7 6-7 12-7-12 7-6z" />
        <path d="M5 9h14" />
      </svg>
    </HubIcon>

    <!-- Hub panel overlay -->
    <HubPanel
      v-if="activePanel"
      :title="panelTitle"
      :origin="panelOrigin"
      :max-width="activePanel === 'quests' ? 760 : undefined"
      @close="closePanel"
    >
      <!-- Header actions per panel -->
      <template #actions>
        <button
          v-if="activePanel === 'quests'"
          type="button"
          class="hdr-btn"
          @click="openNewQuestForm"
        >
          + New Quest
        </button>
        <template v-else-if="activePanel === 'campaigns'">
          <button v-if="selectedCampaign" type="button" class="hdr-btn" @click="backToCampaignList">
            ← Back
          </button>
          <button v-else type="button" class="hdr-btn" @click="showNewCampaignForm = !showNewCampaignForm">
            {{ showNewCampaignForm ? '✕ Cancel' : '+ New Campaign' }}
          </button>
        </template>
      </template>

      <!-- Status -->
      <template v-if="activePanel === 'status'">
        <div class="stat-row"><span>Name</span><span>{{ player.name ?? 'Hunter' }}</span></div>
        <div class="stat-row"><span>Level</span><span>{{ player.level }}</span></div>
        <div class="stat-xp">
          <div class="stat-xp-head">
            <span>XP</span>
            <span>{{ player.progress.current }} / {{ player.progress.needed }}</span>
          </div>
          <XpBar :percent="xpPercent" />
        </div>
        <div class="stat-row"><span>Quests completed</span><span>0</span></div>
        <div class="stat-row"><span>Active quests</span><span>{{ activeQuests?.length ?? 0 }}</span></div>
      </template>

      <!-- Quests -->
      <template v-else-if="activePanel === 'quests'">
        <p v-if="pending" class="hint">Loading quests…</p>
        <p v-else-if="error" class="hint err">Could not load quests.</p>
        <div v-else class="quest-groups">
          <section
            v-for="group in questGroups"
            :key="group.key"
            class="quest-group"
          >
            <div class="group-header" :class="{ 'group-header--overdue': group.isOverdue }">
              {{ group.label }}
            </div>
            <div class="group-quests">
              <QuestCard
                v-for="q in group.quests"
                :key="q.id"
                :quest="q"
                :campaign-name="campaignName(q.campaignId)"
                @completed="onCompleted"
                @deleted="onDeleted"
                @updated="onUpdated"
              />
            </div>
          </section>
          <p v-if="!questGroups.length" class="hint">No active quests.</p>
        </div>
      </template>

      <!-- Campaigns -->
      <template v-else-if="activePanel === 'campaigns'">
        <!-- State 1 — campaign list -->
        <template v-if="!selectedCampaign">
          <form v-if="showNewCampaignForm" class="campaign-form" @submit.prevent="createCampaign">
            <p class="tag">[ NEW CAMPAIGN ]</p>
            <input v-model="campaignTitle" type="text" placeholder="Title" required maxlength="255" />
            <textarea v-model="campaignDescription" placeholder="Description (optional)" rows="2" />
            <div class="row">
              <label>
                Rank
                <select v-model="campaignDifficulty">
                  <option v-for="d in CAMPAIGN_DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
                </select>
              </label>
              <label>
                Deadline
                <input v-model="campaignDeadline" type="date" />
              </label>
            </div>
            <button type="submit" :disabled="creatingCampaign">
              {{ creatingCampaign ? 'Saving…' : 'Create campaign' }}
            </button>
          </form>

          <div class="quest-list">
            <p v-if="!campaigns?.length" class="hint">No campaigns yet. Start one above.</p>
            <button
              v-for="c in campaigns"
              :key="c.id"
              type="button"
              class="campaign-card"
              @click="openCampaign(c.id)"
            >
              <span class="rank-badge">{{ c.difficulty }}</span>
              <span class="campaign-name">{{ c.title }}</span>
              <span class="campaign-count">{{ c.questCount }} quest{{ c.questCount === 1 ? '' : 's' }}</span>
            </button>
          </div>
        </template>

        <!-- State 2 — campaign detail -->
        <template v-else>
          <div class="campaign-detail-head">
            <span class="rank-badge">{{ selectedCampaign.difficulty }}</span>
            <h3>{{ selectedCampaign.title }}</h3>
          </div>
          <p v-if="selectedCampaign.description" class="desc">{{ selectedCampaign.description }}</p>
          <p v-if="campaignDeadlineLabel" class="hint">⌛ {{ campaignDeadlineLabel }}</p>

          <button
            v-if="selectedCampaign.status === 'active'"
            type="button"
            class="complete-campaign"
            @click="completeCampaign"
          >
            Complete Campaign
          </button>

          <div class="quest-list">
            <p v-if="campaignLoading" class="hint">Loading…</p>
            <p v-else-if="!selectedCampaign.quests.length" class="hint">No quests in this campaign yet.</p>
            <QuestCard
              v-for="q in selectedCampaign.quests"
              :key="q.id"
              :quest="q"
              @completed="onCampaignQuestCompleted"
              @deleted="onCampaignQuestDeleted"
              @updated="onCampaignQuestUpdated"
            />
          </div>
        </template>
      </template>

      <!-- Glossary -->
      <template v-else>
        <p class="coming-soon">— Coming soon —</p>
      </template>
    </HubPanel>

    <!-- New-quest form in its own panel, stacked over the Quests panel. -->
    <HubPanel
      v-if="showNewQuestForm"
      title="New Quest"
      :origin="newQuestOrigin"
      @close="showNewQuestForm = false"
    >
      <QuestForm mode="create" @created="onCreated" />
    </HubPanel>

    <LevelUpToast :level="levelUpTo" />
    <RankWarningToast :warnings="rankWarnings" />
  </div>
</template>

<style scoped>
.screen {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
}

/* Status panel body */
.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 1.05rem;
  color: #d0c8f8;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid rgba(42, 32, 80, 0.6);
}
.stat-row span:first-child { color: #8174b8; }
.stat-xp { display: flex; flex-direction: column; gap: 0.5rem; }
.stat-xp-head { display: flex; justify-content: space-between; font-size: 0.9rem; color: #8174b8; }

/* Quests panel body */
.quest-list { display: flex; flex-direction: column; gap: 0.7rem; }

/* Quests grouped into day-sections */
.quest-groups {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.quest-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.group-header {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #4a3d7a;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid rgba(74, 61, 122, 0.3);
}
.group-header--overdue {
  color: #c0543a;
  border-bottom-color: rgba(192, 84, 58, 0.3);
}
.group-quests {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.hint { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
.hint.err { color: #ff8080; }

.coming-soon { margin: 1rem 0; text-align: center; font-size: 0.85rem; color: #4a3d7a; }

/* Campaigns panel */
.campaign-form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
}
.campaign-form .tag { margin: 0; letter-spacing: 0.3em; font-size: 0.7rem; color: #7c5ce8; }
.campaign-form input,
.campaign-form textarea,
.campaign-form select {
  padding: 0.55rem 0.7rem;
  background: #0a0618;
  border: 1px solid #2a2050;
  color: #ece8fb;
  font: inherit;
  font-size: 0.9rem;
  outline: none;
}
.campaign-form input:focus,
.campaign-form textarea:focus,
.campaign-form select:focus {
  border-color: #7c5ce8;
  box-shadow: 0 0 0 2px rgba(124, 92, 232, 0.3);
}
.campaign-form textarea { resize: vertical; }
.campaign-form .row { display: flex; gap: 0.7rem; }
.campaign-form .row label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #8174b8;
}
.campaign-form button {
  padding: 0.6rem;
  background: linear-gradient(180deg, #6a4fd8, #4a35a8);
  border: none;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 14px rgba(124, 92, 232, 0.45);
}
.campaign-form button:disabled { opacity: 0.6; cursor: not-allowed; }

.campaign-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 1rem;
  text-align: left;
  background: rgba(14, 9, 30, 0.6);
  border: 1px solid #2a2050;
  color: #ece8fb;
  cursor: pointer;
}
.campaign-card:hover { border-color: #7c5ce8; }
.rank-badge {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  font-weight: 800;
  background: #0a0618;
  border: 1px solid #6a50c8;
  color: #c9bcff;
}
.campaign-name { flex: 1 1 auto; font-size: 0.95rem; }
.campaign-count { flex: 0 0 auto; font-size: 0.75rem; color: #8174b8; }

.campaign-detail-head { display: flex; align-items: center; gap: 0.75rem; }
.campaign-detail-head h3 { margin: 0; font-size: 1.1rem; color: #ece8fb; }
.desc { margin: 0; font-size: 0.85rem; color: #8174b8; }
.complete-campaign {
  align-self: flex-start;
  padding: 0.55rem 1rem;
  background: linear-gradient(180deg, #6a4fd8, #4a35a8);
  border: none;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 14px rgba(124, 92, 232, 0.45);
}

/* Header action buttons (HubPanel #actions slot) */
.hdr-btn {
  background: transparent;
  border: 1px solid #2a2050;
  color: #d0c8f8;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
}
.hdr-btn:hover { border-color: #7c5ce8; }
</style>
