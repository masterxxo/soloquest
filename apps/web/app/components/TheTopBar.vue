<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';

defineProps<{ loggingOut: boolean }>();
const emit = defineEmits<{ signout: [] }>();

// Reads the player projection straight from the store (single source of UI state).
const player = usePlayerStore();

// XP fill for the bar, clamped to [0, 100].
const xpPercent = computed(() => {
  const { current, needed } = player.progress;
  if (!needed) return 0;
  return Math.min(100, Math.max(0, (current / needed) * 100));
});
</script>

<template>
  <header class="topbar">
    <!-- Always-present filter for the header's jagged pulse line (the panel's
         #sq-energy filter lives inside its Teleport and isn't reachable here). -->
    <svg class="sq-filter" aria-hidden="true" focusable="false">
      <filter id="sq-pulse" x="-5%" y="-500%" width="110%" height="1100%">
        <!-- Static (no animate): the jagged shape stays constant; only a light
             pulse travels along it. -->
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.02 0.18"
          numOctaves="2"
          seed="4"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="9"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>

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
        <XpBar :percent="xpPercent" />
        <span class="tb-xp-text">{{ player.progress.current }} / {{ player.progress.needed }}</span>
      </div>
      <button class="signout" type="button" :disabled="loggingOut" @click="emit('signout')">
        {{ loggingOut ? 'Signing out…' : 'Sign out' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
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
  /* Denser dark backing so the controls (bar, borders, dim labels) have contrast
     to read against — fades to transparent only near the very bottom. */
  background: linear-gradient(180deg, rgba(4, 2, 12, 0.97) 0%, rgba(4, 2, 12, 0.9) 60%, rgba(4, 2, 12, 0) 100%);
}
/* Jagged divider line in place of a plain border. The displacement filter tears
   the thin line vertically into a constant jagged shape; a brighter light pulse
   travels across it (the static base layer stays put, only the pulse layer moves). */
.topbar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background-image:
    /* travelling light pulse */
    linear-gradient(90deg, transparent 0%, rgba(236, 230, 255, 0.95) 50%, transparent 100%),
    /* static base line */
    linear-gradient(
      90deg,
      rgba(124, 92, 232, 0) 0%,
      rgba(124, 92, 232, 0.6) 12%,
      rgba(124, 92, 232, 0.7) 50%,
      rgba(124, 92, 232, 0.6) 88%,
      rgba(124, 92, 232, 0) 100%
    );
  background-size: 35% 100%, 100% 100%;
  background-repeat: no-repeat;
  background-position: -35% 0, 0 0;
  filter: url(#sq-pulse) drop-shadow(0 0 6px rgba(124, 92, 232, 0.85));
  pointer-events: none;
  animation: sq-pulse-travel 3.4s linear infinite alternate;
}
/* Sweep only the pulse layer (first position) from off-left to off-right. */
@keyframes sq-pulse-travel {
  0%   { background-position: -35% 0, 0 0; }
  100% { background-position: 135% 0, 0 0; }
}
/* Hidden host for the SVG filter definition — renders nothing itself. */
.sq-filter {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}
.topbar-left { display: flex; flex-direction: column; gap: 0.25rem; }
.sys-tag { margin: 0; letter-spacing: 0.32em; font-size: 0.72rem; text-transform: uppercase; color: #7c5ce8; }
.hunter-name { margin: 0; font-size: 1.6rem; font-weight: 700; color: #ece8fb; text-shadow: 0 0 16px rgba(124, 92, 232, 0.6), 0 2px 8px rgba(0, 0, 0, 0.7); }

.topbar-right { display: flex; align-items: center; gap: 1.5rem; }
.tb-level { display: flex; align-items: baseline; gap: 0.45rem; }
.tb-level-label { font-size: 0.72rem; letter-spacing: 0.2em; color: #9a8cd0; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8); }
.tb-level-num { font-size: 1.9rem; font-weight: 800; color: #9c7cff; text-shadow: 0 0 16px rgba(124, 92, 232, 0.8), 0 2px 8px rgba(0, 0, 0, 0.7); }

.tb-xp { display: flex; flex-direction: column; gap: 0.35rem; min-width: 170px; }
.tb-xp-text { font-size: 0.74rem; color: #b0a4e0; text-align: right; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8); }

.signout {
  padding: 0.6rem 1rem;
  background: rgba(8, 5, 20, 0.5);
  border: 1px solid rgba(124, 92, 232, 0.5);
  color: #d0c8f8;
  font: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.signout:hover:not(:disabled) { background: rgba(124, 92, 232, 0.15); }
.signout:disabled { opacity: 0.6; cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .topbar::after { animation: none; }
}
</style>
