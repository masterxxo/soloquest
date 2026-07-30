<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '~/stores/player';
import { useQuestsStore } from '~/stores/quests';
import { useSignOut } from '~/composables/useSignOut';
import { useUserSettings } from '~/composables/useUserSettings';
import { useReducedMotion } from '~/composables/useReducedMotion';
import { client } from '~/lib/api-client';
import {
  STREAK_ACHIEVEMENT_THRESHOLDS,
  TOTAL_ACHIEVEMENT_THRESHOLDS,
  achievementLadder,
} from '~/lib/achievements';

const player = usePlayerStore();
const quests = useQuestsStore();
const { activeQuests, recurringQuests } = storeToRefs(quests);

onMounted(() => { quests.load(); });

const { data: questStats } = useAsyncData(
  'quest-stats',
  async () => {
    const res = await client.api.quests.stats.$get();
    return res.ok ? await res.json() : null;
  },
  { server: false, default: () => null },
);
const completedCount = computed(() => questStats.value?.totalCompleted ?? null);
const activeCount = computed(() => activeQuests.value.filter((q) => q.parentId == null).length);
const xpRemaining = computed(() => Math.max(0, player.xpForNext - player.progress.current));

// Achievements are derived client-side (no read endpoint): a chip is unlocked when the best
// value any ritual has reached clears its threshold. Streak → longest; total → completions.
const bestLongest = computed(() =>
  Math.max(0, ...recurringQuests.value.map((q) => q.streak?.longestStreak ?? 0)),
);
const bestTotal = computed(() =>
  Math.max(0, ...recurringQuests.value.map((q) => q.streak?.totalCompletions ?? 0)),
);
const streakLadder = computed(() => achievementLadder(STREAK_ACHIEVEMENT_THRESHOLDS, bestLongest.value));
const totalLadder = computed(() => achievementLadder(TOTAL_ACHIEVEMENT_THRESHOLDS, bestTotal.value));
const unlockedCount = computed(
  () => [...streakLadder.value, ...totalLadder.value].filter((c) => c.unlocked).length,
);
const totalAchievements = STREAK_ACHIEVEMENT_THRESHOLDS.length + TOTAL_ACHIEVEMENT_THRESHOLDS.length;

// Placeholder attribute meters — the mechanic does not exist (NEEDS DOMAIN). Presentation only.
const ATTRIBUTES = [
  { key: 'STR', pct: 62 },
  { key: 'INT', pct: 74 },
  { key: 'AGI', pct: 48 },
];

const settings = useUserSettings();
function onTimezoneChange(event: Event) {
  settings.setTimezone((event.target as HTMLSelectElement).value);
}

// Reduce reward effects: a persisted client preference that forces the static path independently
// of the OS setting. State, persistence (localStorage) and the `<html class="dl-reduce-motion">`
// stamp all live in useReducedMotion — the single source both this toggle and every reward
// animation read — so binding the checkbox to it is all this page needs to do.
const { reduceEffects } = useReducedMotion();

const { loggingOut, onSignOut } = useSignOut();
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dl-band-line pb-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">
      <span class="text-dl-ink">Status</span>
      <span class="normal-case text-dl-ink-faint">Profile, achievements, tags and settings.</span>
      <span class="ml-auto border border-dl-gold bg-dl-gold/10 px-2 py-0.5 text-dl-ink">2 sections need domain confirmation</span>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- ── Left column ─────────────────────────────────────────────────────────── -->
      <div class="flex flex-col gap-4">
        <!-- Profile -->
        <div class="corner-cut grid grid-cols-[auto_1fr] gap-4 border border-dl-grid-line bg-dl-surface p-4">
          <div class="corner-cut-sm grid h-28 w-28 place-items-center border border-dl-grid-line bg-dl-sunk p-2 text-center font-dl-mono text-[0.6rem] uppercase leading-tight tracking-wide text-dl-ink-faint">Operator portrait</div>
          <div class="flex min-w-0 flex-col gap-2">
            <div class="flex flex-col leading-none">
              <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Operator</span>
              <span class="truncate font-dl-display text-dl-title font-semibold text-dl-ink">{{ player.name ?? 'Hunter' }}</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex flex-col leading-none">
                <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Level</span>
                <span class="font-dl-display text-dl-numeral font-semibold text-dl-ink">{{ player.level }}</span>
              </div>
              <RankBadge :rank="player.rank" />
            </div>
            <div class="flex flex-col gap-1">
              <div class="flex justify-between font-dl-mono text-dl-label text-dl-ink-muted">
                <span class="uppercase tracking-wide">XP to level {{ player.level + 1 }}</span>
                <span class="text-dl-ink">{{ player.progress.current.toLocaleString() }} / {{ player.xpForNext.toLocaleString() }}</span>
              </div>
              <XpBar :percent="player.xpPct" />
              <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ xpRemaining.toLocaleString() }} XP remaining</span>
            </div>
          </div>
        </div>

        <!-- Quick counters -->
        <div class="grid grid-cols-3 gap-3">
          <div class="corner-cut flex flex-col items-center gap-1 border border-dl-grid-line bg-dl-surface py-3">
            <span class="font-dl-display text-dl-title font-semibold text-dl-ink">{{ activeCount }}</span>
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Active</span>
          </div>
          <div class="corner-cut flex flex-col items-center gap-1 border border-dl-grid-line bg-dl-surface py-3">
            <span class="font-dl-display text-dl-title font-semibold text-dl-magenta">{{ player.overdueCount }}</span>
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Overdue</span>
          </div>
          <div class="corner-cut flex flex-col items-center gap-1 border border-dl-grid-line bg-dl-surface py-3">
            <span class="font-dl-display text-dl-title font-semibold text-dl-ink">{{ completedCount ?? '—' }}</span>
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Completed</span>
          </div>
        </div>

        <RankLadder />

        <!-- Attributes (NEEDS DOMAIN) -->
        <section class="corner-cut flex flex-col gap-3 border border-dl-grid-line bg-dl-surface p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Attributes · STR / INT / AGI</span>
            <span class="border border-dl-gold bg-dl-gold/10 px-2 py-0.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink">Placeholder values</span>
          </div>
          <p class="m-0 flex gap-2 border border-dl-gold bg-dl-gold/10 px-3 py-2 text-dl-meta text-dl-ink">
            <span aria-hidden="true" class="text-dl-gold">!</span>
            Needs domain confirmation — mechanic does not exist. No STR/INT/AGI fields or deriving rule exist; this block is presentation only.
          </p>
          <div v-for="attr in ATTRIBUTES" :key="attr.key" class="flex flex-col gap-1">
            <div class="flex justify-between font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">
              <span>{{ attr.key }}</span>
              <span class="text-dl-ink-faint underline decoration-dashed underline-offset-2">—</span>
            </div>
            <div class="h-2 overflow-hidden bg-dl-sunk"><div class="h-full bg-dl-ink-faint" :style="{ width: `${attr.pct}%` }" /></div>
            <span class="font-dl-mono text-[0.6rem] uppercase tracking-wide text-dl-ink-faint">Source undefined</span>
          </div>
        </section>
      </div>

      <!-- ── Right column ────────────────────────────────────────────────────────── -->
      <div class="flex flex-col gap-4">
        <!-- Achievements -->
        <section class="corner-cut flex flex-col gap-4 border border-dl-grid-line bg-dl-surface p-4">
          <div class="flex items-center justify-between">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Achievements</span>
            <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ unlockedCount }} of {{ totalAchievements }} unlocked</span>
          </div>

          <div class="flex flex-col gap-2">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Streak · best {{ bestLongest }} days</span>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="chip in streakLadder"
                :key="chip.threshold"
                class="corner-cut-sm flex flex-col items-center gap-0.5 border px-3 py-1.5"
                :class="chip.unlocked ? 'border-dl-gold bg-dl-gold/10 text-dl-ink' : 'border-dl-hairline text-dl-ink-faint'"
              >
                <span class="font-dl-display text-dl-body font-semibold">{{ chip.threshold }}</span>
                <span class="font-dl-mono text-[0.55rem] uppercase tracking-wide">{{ chip.unlocked ? 'days' : 'pending' }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Total completions · best {{ bestTotal }}</span>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="chip in totalLadder"
                :key="chip.threshold"
                class="corner-cut-sm flex flex-col items-center gap-0.5 border px-3 py-1.5"
                :class="chip.unlocked ? 'border-dl-gold bg-dl-gold/10 text-dl-ink' : 'border-dl-hairline text-dl-ink-faint'"
              >
                <span class="font-dl-display text-dl-body font-semibold">{{ chip.threshold }}</span>
                <span class="font-dl-mono text-[0.55rem] uppercase tracking-wide">{{ chip.unlocked ? 'done' : 'pending' }}</span>
              </div>
            </div>
          </div>
        </section>

        <TagManager />

        <!-- Settings -->
        <section class="corner-cut flex flex-col gap-4 border border-dl-grid-line bg-dl-surface p-4">
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Settings</span>

          <div class="flex flex-col gap-1.5">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink">Time zone <span class="text-dl-ink-faint">· {{ settings.currentOffset.value || '—' }}</span></span>
            <p class="m-0 text-dl-meta text-dl-ink-muted">Decides which calendar day a completion belongs to — and therefore every streak, heatmap cell and date group.</p>
            <div class="flex items-center gap-2">
              <select
                :value="settings.timezone.value"
                :disabled="settings.saving.value || settings.loading.value"
                class="dl-focus-inset min-w-0 flex-1 border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none disabled:opacity-60"
                @change="onTimezoneChange"
              >
                <option v-for="tz in settings.timezones.value" :key="tz" :value="tz">{{ tz }}</option>
              </select>
              <button
                type="button"
                :disabled="settings.saving.value || settings.loading.value"
                class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink disabled:opacity-60"
                @click="settings.detect()"
              >Detect</button>
            </div>
            <p class="m-0 font-dl-mono text-[0.6rem] uppercase tracking-wide text-dl-ink-faint">Changing it does not rewrite history · past entries keep their recorded day</p>
            <p v-if="settings.saveError.value" class="m-0 text-dl-meta text-dl-magenta">{{ settings.saveError.value }}</p>
            <p v-else-if="settings.justSaved.value" class="m-0 text-dl-meta text-dl-cyan">Saved</p>
          </div>

          <label class="flex cursor-pointer items-start justify-between gap-3">
            <span class="flex flex-col gap-0.5">
              <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink">Reduce reward effects</span>
              <span class="text-dl-meta text-dl-ink-muted">Forces the static reward path — no chromatic split, no full-surface inversion — independently of the OS reduced-motion setting.</span>
            </span>
            <input v-model="reduceEffects" type="checkbox" class="dl-focus-inset mt-1 h-5 w-5 shrink-0 cursor-pointer accent-dl-violet" />
          </label>

          <div class="flex flex-col gap-0.5">
            <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink">Sign out</span>
            <p class="m-0 text-dl-meta text-dl-ink-muted">Ends this session on this device. Nothing is deleted.</p>
            <button
              type="button"
              class="dl-focus-inset mt-1 min-h-dl-touch w-full cursor-pointer border border-dl-grid-line bg-dl-surface px-4 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted transition-colors enabled:hover:border-dl-magenta enabled:hover:text-dl-magenta disabled:opacity-60"
              :disabled="loggingOut"
              @click="onSignOut"
            >{{ loggingOut ? 'Signing out…' : 'Sign out' }}</button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
