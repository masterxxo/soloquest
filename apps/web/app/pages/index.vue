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
function openPanel(panel: Panel) { activePanel.value = panel; }
function closePanel() { activePanel.value = null; }

// XP fill for the top-bar bar, clamped to [0, 100].
const xpPercent = computed(() => {
  const { current, needed } = player.progress;
  if (!needed) return 0;
  return Math.min(100, Math.max(0, (current / needed) * 100));
});
</script>

<template>
  <div class="screen">
    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar-left">
        <p class="sys-tag">[ system ]</p>
        <p class="hunter-name">{{ player.name ?? 'Hunter' }}</p>
      </div>

      <div class="topbar-right">
        <div class="tb-level">
          <span class="tb-level-label">LVL</span>
          <span class="tb-level-num">{{ player.level }}</span>
        </div>
        <div class="tb-xp">
          <div class="tb-bar">
            <div class="tb-bar-fill" :style="{ width: `${xpPercent}%` }" />
          </div>
          <span class="tb-xp-text">{{ player.progress.current }} / {{ player.progress.needed }}</span>
        </div>
        <button class="signout" type="button" :disabled="loggingOut" @click="onSignOut">
          {{ loggingOut ? 'Signing out…' : 'Sign out' }}
        </button>
      </div>
    </header>

    <!-- Character -->
    <div class="character">
      <img class="character-img" src="/images/character.svg" alt="Hunter character" />
      <div class="character-tint" />
    </div>

    <!-- Hub icons -->
    <button class="hub-icon" style="left: 15%; top: 32%" type="button" @click="openPanel('status')">
      <span class="hub-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </span>
      <span class="hub-label">Status</span>
    </button>

    <button class="hub-icon" style="left: 15%; top: 62%" type="button" @click="openPanel('quests')">
      <span class="hub-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <line x1="8.5" y1="8" x2="15.5" y2="8" />
          <line x1="8.5" y1="12" x2="15.5" y2="12" />
          <line x1="8.5" y1="16" x2="13" y2="16" />
        </svg>
      </span>
      <span class="hub-label">Quests</span>
    </button>

    <button class="hub-icon" style="left: 85%; top: 32%" type="button" @click="openPanel('campaigns')">
      <span class="hub-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l7 2.5V11c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V5.5L12 3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </span>
      <span class="hub-label">Campaigns</span>
    </button>

    <button class="hub-icon" style="left: 85%; top: 62%" type="button" @click="openPanel('glossary')">
      <span class="hub-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6c-1.5-1.2-3.5-1.8-6-1.8V18c2.5 0 4.5.6 6 1.8" />
          <path d="M12 6c1.5-1.2 3.5-1.8 6-1.8V18c-2.5 0-4.5.6-6 1.8" />
          <line x1="12" y1="6" x2="12" y2="19.8" />
        </svg>
      </span>
      <span class="hub-label">Glossary</span>
    </button>

    <div class="hub-icon hub-icon--disabled" style="left: 50%; top: 90%">
      <span class="hub-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="#8b78e0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l7 6-7 12-7-12 7-6z" />
          <path d="M5 9h14" />
        </svg>
      </span>
      <span class="hub-label">Items</span>
    </div>

    <!-- Hub panel overlay -->
    <Teleport to="body">
      <div v-if="activePanel" class="overlay" @click.self="closePanel">
        <!-- Fractal-noise displacement filter: warps the border energy into an
             irregular, writhing shape rather than a clean rectangle outline. -->
        <svg class="sq-filter" aria-hidden="true" focusable="false">
          <filter id="sq-energy" x="-60%" y="-60%" width="220%" height="220%">
            <!-- Low baseFrequency = large, slow undulations that bend the whole
                 rectangle sides into curves (kills the boxy read); the extra
                 octaves add finer crackle on top of those big bends. -->
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014 0.028"
              numOctaves="4"
              seed="7"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="10s"
                values="0.014 0.028;0.02 0.04;0.011 0.022;0.014 0.028"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
              result="disp"
            />
            <!-- Diffuse the displaced shape into a glow so it reads as haze,
                 not a crisp geometric outline. -->
            <feGaussianBlur in="disp" stdDeviation="1.1" />
          </filter>
        </svg>
        <div class="panel">
          <span class="corner corner-tl" />
          <span class="corner corner-tr" />
          <span class="corner corner-bl" />
          <span class="corner corner-br" />

          <div class="panel-head">
            <span class="panel-title">{{ panelTitle }}</span>
            <button class="panel-close" type="button" @click="closePanel">✕ Close</button>
          </div>

          <div class="panel-scroll">
          <!-- Status -->
          <div v-if="activePanel === 'status'" class="panel-body">
            <div class="stat-row"><span>Name</span><span>{{ player.name ?? 'Hunter' }}</span></div>
            <div class="stat-row"><span>Level</span><span>{{ player.level }}</span></div>
            <div class="stat-xp">
              <div class="stat-xp-head">
                <span>XP</span>
                <span>{{ player.progress.current }} / {{ player.progress.needed }}</span>
              </div>
              <div class="tb-bar">
                <div class="tb-bar-fill" :style="{ width: `${xpPercent}%` }" />
              </div>
            </div>
            <div class="stat-row"><span>Quests completed</span><span>0</span></div>
            <div class="stat-row"><span>Active quests</span><span>{{ activeQuests?.length ?? 0 }}</span></div>
          </div>

          <!-- Quests -->
          <div v-else-if="activePanel === 'quests'" class="panel-body">
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
          </div>

          <!-- Campaigns -->
          <div v-else-if="activePanel === 'campaigns'" class="panel-body">
            <p class="coming-soon">— Coming soon —</p>
          </div>

          <!-- Glossary -->
          <div v-else-if="activePanel === 'glossary'" class="panel-body">
            <p class="coming-soon">— Coming soon —</p>
          </div>
          </div>
        </div>
      </div>
    </Teleport>

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
.screen {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
}

/* ── Top bar ─────────────────────────────────────────────── */
.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 0.85rem 2rem;
  /* Stronger, taller dark fade so the header text stays legible over the
     lighter top of the backdrop image. */
  background: linear-gradient(180deg, rgba(4, 2, 12, 0.95) 0%, rgba(4, 2, 12, 0.75) 45%, rgba(4, 2, 12, 0) 100%);
  border-bottom: 2px solid rgba(150, 120, 255, 0.55);
}
.topbar-left { display: flex; flex-direction: column; gap: 0.25rem; }
.sys-tag { margin: 0; letter-spacing: 0.32em; font-size: 0.72rem; text-transform: uppercase; color: #7c5ce8; }
.hunter-name { margin: 0; font-size: 1.6rem; font-weight: 700; color: #ece8fb; text-shadow: 0 0 16px rgba(124, 92, 232, 0.6), 0 2px 8px rgba(0, 0, 0, 0.7); }

.topbar-right { display: flex; align-items: center; gap: 1.5rem; }
.tb-level { display: flex; align-items: baseline; gap: 0.45rem; }
.tb-level-label { font-size: 0.72rem; letter-spacing: 0.2em; color: #6a5aa0; }
.tb-level-num { font-size: 1.9rem; font-weight: 800; color: #9c7cff; text-shadow: 0 0 16px rgba(124, 92, 232, 0.8), 0 2px 8px rgba(0, 0, 0, 0.7); }

.tb-xp { display: flex; flex-direction: column; gap: 0.35rem; min-width: 170px; }
.tb-bar {
  height: 10px;
  background: #0a0618;
  border: 1px solid #2a2050;
  border-radius: 0;
  overflow: hidden;
}
.tb-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #5a3fd0, #9c7cff);
  box-shadow: 0 0 10px rgba(124, 92, 232, 0.8);
  transition: width 0.4s ease;
}
.tb-xp-text { font-size: 0.74rem; color: #8174b8; text-align: right; }

.signout {
  padding: 0.6rem 1rem;
  background: rgba(8, 5, 20, 0.5);
  border: 1px solid #2a2050;
  border-radius: 0;
  color: #d0c8f8;
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.signout:hover:not(:disabled) { background: rgba(124, 92, 232, 0.15); }
.signout:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Character ───────────────────────────────────────────── */
.character {
  position: absolute;
  /* Lifted off the very bottom just enough to clear the Items slot beneath the feet. */
  bottom: 19vh;
  left: 50%;
  transform: translateX(-50%);
  width: 342px;
  max-width: 28.5vw;
  pointer-events: none;
  user-select: none;
}
.character-img {
  display: block;
  width: 100%;
  height: auto;
  mix-blend-mode: multiply;
  /* multiply against the dark backdrop crushes the character — lift it back up. */
  filter: brightness(0.9) contrast(0.98) saturate(1.05)
    drop-shadow(0 0 40px rgba(124, 92, 232, 0.5));
}
/* Very subtle purple wash over the character silhouette, brighter at the top.
   Masked to the same artwork so the tint only lands on the figure. */
.character-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(150, 120, 255, 0.18),
    rgba(124, 92, 232, 0.06) 45%,
    rgba(124, 92, 232, 0) 80%
  );
  mix-blend-mode: screen;
  -webkit-mask-image: url('/images/character.svg');
  mask-image: url('/images/character.svg');
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

/* ── Hub icons ───────────────────────────────────────────── */
.hub-icon {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}
.hub-box {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  background: rgba(8, 5, 20, 0.85);
  border: 1px solid rgba(80, 50, 160, 0.4);
  border-radius: 0;
  backdrop-filter: blur(8px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.hub-box svg { width: 30px; height: 30px; }
.hub-icon:hover .hub-box {
  border-color: #7c5ce8;
  box-shadow: 0 0 16px rgba(124, 92, 232, 0.5);
}
.hub-label {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8174b8;
}
.hub-icon--disabled {
  opacity: 0.35;
  pointer-events: none;
}

/* ── Panel overlay ───────────────────────────────────────── */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(4, 3, 12, 0.75);
  backdrop-filter: blur(4px);
}
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 540px;
  max-height: 88vh;
  /* Visible so the displaced border energy can spill past the frame instead of
     being clipped flat. The frame stays put; only .panel-scroll scrolls. */
  overflow: visible;
  padding: 2.25rem;
  background: rgba(8, 5, 20, 0.97);
  border: 1px solid #2a2050;
  border-radius: 0;
  box-shadow: 0 0 40px rgba(124, 92, 232, 0.25);
}

/* Animatable angles for the two border "energy strands". @property lets us tween
   an <angle>, which plain CSS custom properties can't do. */
@property --sq-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
@property --sq-angle2 {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
/* Two conic-gradient segments, each masked to just the 2px frame ring, travelling
   the panel border at uneven speeds — the static border underneath is the resting
   state. The irregular keyframes + flicker + non-harmonic durations read as an
   unstable energy flow rather than a mechanical sweep. */
.panel::before,
.panel::after {
  content: '';
  position: absolute;
  /* Extend the ring beyond the panel so the energy sits OUTSIDE the container,
     over the page backdrop showing through — not on the opaque panel fill.
     inset == padding makes the band's inner edge meet the panel edge (no gap). */
  inset: -7px;
  /* Ring thickness: a thinner band reads as a sharper energy filament. */
  padding: 7px;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  /* Roughen the clean rectangular ring into a jagged, writhing energy shape. */
  filter: url(#sq-energy);
}
/* Hidden host for the SVG filter definition — renders nothing itself. */
.sq-filter {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}
/* Primary strand — surges, then stalls, like an uneven discharge. */
.panel::before {
  background: conic-gradient(
    from var(--sq-angle),
    transparent 0deg,
    transparent 70deg,
    rgba(156, 124, 255, 0.85) 92deg,
    #d4c6ff 110deg,
    rgba(156, 124, 255, 0.85) 128deg,
    transparent 150deg,
    transparent 360deg
  );
  animation: sq-travel 14s linear infinite;
}
/* Secondary strand — shorter, faster, out of phase; a second spark chasing it. */
.panel::after {
  background: conic-gradient(
    from var(--sq-angle2),
    transparent 0deg,
    transparent 40deg,
    rgba(196, 179, 255, 0.8) 52deg,
    #ffffff 60deg,
    rgba(196, 179, 255, 0.8) 68deg,
    transparent 82deg,
    transparent 360deg
  );
  animation: sq-travel2 19s linear infinite;
}
/* Slow, uniform travel — constant angular speed, no surges. */
@keyframes sq-travel {
  to { --sq-angle: 360deg; }
}
@keyframes sq-travel2 {
  to { --sq-angle2: 360deg; }
}
@media (prefers-reduced-motion: reduce) {
  .panel::before,
  .panel::after {
    animation: none;
  }
  .panel::after {
    opacity: 0;
  }
}
.panel-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
/* Decorative corner brackets. */
.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid #6a50c8;
}
.corner-tl { top: 8px; left: 8px; border-right: none; border-bottom: none; }
.corner-tr { top: 8px; right: 8px; border-left: none; border-bottom: none; }
.corner-bl { bottom: 8px; left: 8px; border-right: none; border-top: none; }
.corner-br { bottom: 8px; right: 8px; border-left: none; border-top: none; }

.panel-head {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.75rem;
}
.panel-title { font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; color: #7c5ce8; }
.panel-close {
  background: none;
  border: none;
  color: #8174b8;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.panel-close:hover { color: #d0c8f8; }
.panel-body { display: flex; flex-direction: column; gap: 1.1rem; }

/* Status panel */
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

/* Quests panel */
.quest-list { display: flex; flex-direction: column; gap: 0.7rem; }
.hint { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
.hint.err { color: #ff8080; }

.coming-soon { margin: 1rem 0; text-align: center; font-size: 0.85rem; color: #4a3d7a; }

/* ── Level-up feedback ───────────────────────────────────── */
.levelup {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  padding: 1rem 2rem;
  text-align: center;
  background: rgba(8, 5, 20, 0.95);
  border: 1px solid #7c5ce8;
  border-radius: 0;
  box-shadow: 0 0 30px rgba(124, 92, 232, 0.7), inset 0 0 18px rgba(124, 92, 232, 0.25);
  backdrop-filter: blur(6px);
}
.levelup-tag { margin: 0; letter-spacing: 0.3em; font-size: 0.65rem; color: #7c5ce8; }
.levelup-main { margin: 0.2rem 0; font-size: 1.6rem; font-weight: 800; color: #eae4ff; text-shadow: 0 0 14px rgba(124, 92, 232, 0.9); }
.levelup-sub { margin: 0; font-size: 0.8rem; color: #9b8fd6; }
.levelup-enter-active, .levelup-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.levelup-enter-from, .levelup-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
</style>
