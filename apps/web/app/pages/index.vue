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
</script>

<template>
  <div class="dashboard">
    <!-- Player panel -->
    <section class="sq-panel">
      <div class="panel-head">
        <div>
          <p class="sq-tag">[ SYSTEM ]</p>
          <h1>{{ player.name ?? 'Hunter' }}</h1>
        </div>
        <button class="ghost" type="button" :disabled="loggingOut" @click="onSignOut">
          {{ loggingOut ? 'Signing out…' : 'Sign out' }}
        </button>
      </div>

      <div class="sq-stats">
        <div class="sq-level">
          <span class="sq-level-label">LEVEL</span>
          <span class="sq-level-num">{{ player.level }}</span>
        </div>
        <div class="sq-xp">
          <div class="sq-xp-head">
            <span>XP</span>
            <span>{{ player.progress.current }} / {{ player.progress.needed }}</span>
          </div>
          <div class="sq-bar">
            <div
              class="sq-bar-fill"
              :style="{ width: `${(player.progress.current / player.progress.needed) * 100}%` }"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Quests -->
    <section class="quests">
      <QuestForm @created="onCreated" />

      <div class="list">
        <h2>Active quests</h2>
        <p v-if="pending" class="hint">Loading quests…</p>
        <p v-else-if="error" class="hint err">Could not load quests.</p>
        <p v-else-if="!activeQuests?.length" class="hint">No active quests. Issue one above.</p>
        <QuestCard
          v-for="q in activeQuests"
          :key="q.id"
          :quest="q"
          @completed="onCompleted"
          @deleted="onDeleted"
        />
      </div>
    </section>

    <!-- Level-up feedback -->
    <Transition name="levelup">
      <div v-if="levelUpTo !== null" class="levelup">
        <p class="levelup-tag">[ SYSTEM ]</p>
        <p class="levelup-main">LEVEL UP</p>
        <p class="levelup-sub">You reached LEVEL {{ levelUpTo }}</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dashboard {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.sq-panel {
  padding: 1.5rem;
  background: rgba(10, 20, 45, 0.75);
  border: 1px solid #2a4dd0;
  border-radius: 12px;
  box-shadow: 0 0 24px rgba(56, 120, 255, 0.35), inset 0 0 18px rgba(56, 120, 255, 0.12);
  backdrop-filter: blur(6px);
}
.panel-head { display: flex; justify-content: space-between; align-items: flex-start; }
.sq-tag { margin: 0; letter-spacing: 0.3em; font-size: 0.7rem; color: #5b8bff; }
h1 { margin: 0.25rem 0 1.25rem; font-size: 1.7rem; color: #eaf2ff; text-shadow: 0 0 12px rgba(91, 139, 255, 0.6); }
.sq-stats { display: flex; flex-direction: column; gap: 1rem; }
.sq-level { display: flex; align-items: baseline; gap: 0.6rem; }
.sq-level-label { font-size: 0.75rem; letter-spacing: 0.2em; color: #8fa9d8; }
.sq-level-num { font-size: 2rem; font-weight: 700; color: #5b8bff; text-shadow: 0 0 14px rgba(91, 139, 255, 0.7); }
.sq-xp-head { display: flex; justify-content: space-between; font-size: 0.75rem; color: #9bb4e6; margin-bottom: 0.4rem; }
.sq-bar { height: 10px; background: #060c1c; border: 1px solid #29407e; border-radius: 999px; overflow: hidden; }
.sq-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2f6bff, #7aa6ff);
  box-shadow: 0 0 12px rgba(91, 139, 255, 0.8);
  transition: width 0.4s ease;
}
.ghost {
  padding: 0.4rem 0.7rem;
  background: transparent;
  border: 1px solid #2a4dd0;
  border-radius: 6px;
  color: #cfe3ff;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
}
.ghost:hover:not(:disabled) { background: rgba(56, 120, 255, 0.15); }
.ghost:disabled { opacity: 0.6; cursor: not-allowed; }
.quests { display: flex; flex-direction: column; gap: 1rem; }
.list { display: flex; flex-direction: column; gap: 0.7rem; }
h2 { margin: 0.5rem 0 0; font-size: 0.85rem; letter-spacing: 0.2em; color: #8fa9d8; text-transform: uppercase; }
.hint { margin: 0; font-size: 0.85rem; color: #8fa9d8; }
.hint.err { color: #ff8080; }
.levelup {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 1rem 2rem;
  text-align: center;
  background: rgba(10, 20, 45, 0.92);
  border: 1px solid #5b8bff;
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(91, 139, 255, 0.7), inset 0 0 18px rgba(91, 139, 255, 0.25);
  backdrop-filter: blur(6px);
}
.levelup-tag { margin: 0; letter-spacing: 0.3em; font-size: 0.65rem; color: #5b8bff; }
.levelup-main { margin: 0.2rem 0; font-size: 1.6rem; font-weight: 800; color: #eaf2ff; text-shadow: 0 0 14px rgba(91, 139, 255, 0.9); }
.levelup-sub { margin: 0; font-size: 0.8rem; color: #9bb4e6; }
.levelup-enter-active, .levelup-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.levelup-enter-from, .levelup-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
