<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '~/stores/player';
import { useQuestsStore } from '~/stores/quests';

const player = usePlayerStore();
const quests = useQuestsStore();
const { activeQuests } = storeToRefs(quests);

onMounted(() => { quests.load(); });

const activeCount = computed(() => activeQuests.value.filter((q) => q.parentId == null).length);
</script>

<template>
  <div class="status">
    <!-- Character stage: the full hunter figure with its drifting haze. The figure is
         sized to the stage (object-contain, bottom-anchored) so the whole hunter —
         face included — stays visible; HubCharacter's viewport-anchored positioning is
         meant for the full-screen dashboard, not this framed panel. -->
    <div class="stage">
      <SmokeCanvas :density="1.2" :speed="0.8" />
      <img class="character" src="/images/character.svg" alt="Hunter character" />
    </div>

    <!-- Stat sheet -->
    <div class="sheet">
      <div class="sheet-head">
        <p class="sys-tag">[ status ]</p>
        <p class="hunter-name">{{ player.name ?? 'Hunter' }}</p>
        <p class="rank-line">Rank <span class="rank">{{ player.rank }}</span> · Level {{ player.level }}</p>
      </div>

      <div class="xp">
        <div class="xp-head">
          <span>XP</span>
          <span>{{ player.progress.current }} / {{ player.xpForNext }}</span>
        </div>
        <XpBar :percent="player.xpPct" />
      </div>

      <div class="stat-grid">
        <div class="stat"><span class="stat-num">{{ activeCount }}</span><span class="stat-label">Active quests</span></div>
        <div class="stat"><span class="stat-num">{{ player.todayCount }}</span><span class="stat-label">Due today</span></div>
        <div class="stat stat--warn"><span class="stat-num">{{ player.overdueCount }}</span><span class="stat-label">Overdue</span></div>
      </div>

      <section class="achievements">
        <h2 class="section-title">Achievements</h2>
        <p class="coming-soon">— Coming soon —</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.status {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(280px, 1.1fr);
  gap: 1.5rem;
  align-items: stretch;
}
/* TODO(responsive): single column below 768px. */

.stage {
  position: relative;
  min-height: 440px;
  overflow: hidden;
  border: 1px solid #2a2050;
  border-radius: 8px;
  background: radial-gradient(120% 90% at 50% 10%, rgba(124, 92, 232, 0.12), transparent 60%), #0a0618;
}
/* Whole figure, bottom-anchored and contained within the stage (never clipped). */
.character {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 100%;
  max-width: 100%;
  object-fit: contain;
  object-position: bottom center;
  pointer-events: none;
  user-select: none;
  filter: brightness(0.95) saturate(1.05) drop-shadow(0 0 40px rgba(124, 92, 232, 0.5));
}

.sheet { display: flex; flex-direction: column; gap: 1.5rem; }
.sheet-head { display: flex; flex-direction: column; gap: 0.35rem; }
.sys-tag { margin: 0; letter-spacing: 0.32em; font-size: 0.7rem; text-transform: uppercase; color: #7c5ce8; }
.hunter-name { margin: 0; font-size: 1.7rem; font-weight: 700; color: #ece8fb; }
.rank-line { margin: 0; font-size: 0.9rem; color: #8a7fb5; }
.rank {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  font-weight: 800;
  color: #fff;
  background: #7c5ce8;
  border-radius: 0.35rem;
}

.xp { display: flex; flex-direction: column; gap: 0.5rem; }
.xp-head { display: flex; justify-content: space-between; font-size: 0.85rem; color: #8174b8; }

.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.85rem;
  text-align: center;
  background: rgba(26, 17, 64, 0.6);
  border: 1px solid #2a2050;
  border-radius: 8px;
}
.stat--warn { border-color: #5a2030; background: rgba(42, 19, 32, 0.7); }
.stat-num { font-size: 1.5rem; font-weight: 700; color: #d0c8f8; }
.stat--warn .stat-num { color: #f0a0a0; }
.stat-label { font-size: 0.68rem; letter-spacing: 0.05em; text-transform: uppercase; color: #8174b8; }

.section-title {
  margin: 0 0 0.6rem;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6a5da0;
}
.coming-soon { margin: 0; font-size: 0.85rem; color: #4a3d7a; }
</style>
