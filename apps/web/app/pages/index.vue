<script setup lang="ts">
import { signOut } from '~/lib/auth-client';
import { client, type Quest, type CompleteResult } from '~/lib/api-client';
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
    const res = await client.api.quests.$get({ query: { status: 'active' } });
    if (!res.ok) throw new Error('Failed to load quests');
    return res.json();
  },
  { server: false, default: () => [] as Quest[] },
);

function onCreated(quest: Quest) {
  activeQuests.value = [quest, ...(activeQuests.value ?? [])];
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

function onUpdated(quest: Quest) {
  activeQuests.value = (activeQuests.value ?? []).map((q) => (q.id === quest.id ? quest : q));
}

// Lightweight "System"-style level-up feedback (no engine animations).
const levelUpTo = ref<number | null>(null);
let levelUpTimer: ReturnType<typeof setTimeout> | null = null;
function showLevelUp(level: number) {
  levelUpTo.value = level;
  if (levelUpTimer) clearTimeout(levelUpTimer);
  levelUpTimer = setTimeout(() => { levelUpTo.value = null; }, 3500);
}
onBeforeUnmount(() => { if (levelUpTimer) clearTimeout(levelUpTimer); });

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
    <HubPanel v-if="activePanel" :title="panelTitle" :origin="panelOrigin" @close="closePanel">
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
        <QuestForm mode="create" @created="onCreated" />
        <div class="quest-list">
          <p v-if="pending" class="hint">Loading quests…</p>
          <p v-else-if="error" class="hint err">Could not load quests.</p>
          <p v-else-if="!activeQuests?.length" class="hint">No active quests. Issue one above.</p>
          <QuestCard
            v-for="q in activeQuests"
            :key="q.id"
            :quest="q"
            @completed="onCompleted"
            @deleted="onDeleted"
            @updated="onUpdated"
          />
        </div>
      </template>

      <!-- Campaigns / Glossary -->
      <template v-else>
        <p class="coming-soon">— Coming soon —</p>
      </template>
    </HubPanel>

    <LevelUpToast :level="levelUpTo" />
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
.hint { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
.hint.err { color: #ff8080; }

.coming-soon { margin: 1rem 0; text-align: center; font-size: 0.85rem; color: #4a3d7a; }
</style>
