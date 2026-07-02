<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '~/stores/player';
import { useQuestsStore } from '~/stores/quests';
import { signOut } from '~/lib/auth-client';

const player = usePlayerStore();
const quests = useQuestsStore();
const { activeQuests } = storeToRefs(quests);

onMounted(() => { quests.load(); });

const activeCount = computed(() => activeQuests.value.filter((q) => q.parentId == null).length);

// Sign out lives here (not in the persistent nav): the mobile bottom bar has no room
// for it, so Status is its single home across desktop and mobile.
const loggingOut = ref(false);
async function onSignOut() {
  loggingOut.value = true;
  await signOut();
  await refreshAuthSession();
  await navigateTo('/login');
}
</script>

<template>
  <div class="grid grid-cols-1 items-stretch gap-6 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1.1fr)]">
    <!-- Columns may shrink to 220px so the two-column view already fits at 768px (the
         content frame is narrowest right at the md breakpoint); the 1fr / 1.1fr ratio is
         unchanged, so the wide-desktop look stays the same. -->
    <!-- Character stage: the full hunter figure with its drifting haze. The figure is
         sized to the stage (object-contain, bottom-anchored) so the whole hunter —
         face included — stays visible; HubCharacter's viewport-anchored positioning is
         meant for the full-screen dashboard, not this framed panel. -->
    <div class="relative min-h-[440px] overflow-hidden rounded-[8px] border border-line bg-panel bg-[radial-gradient(120%_90%_at_50%_10%,rgba(124,92,232,0.12),transparent_60%)]">
      <SmokeCanvas :density="1.2" :speed="0.8" />
      <!-- Whole figure, bottom-anchored and contained within the stage (never clipped). -->
      <img
        class="pointer-events-none absolute bottom-0 left-1/2 h-full max-w-full -translate-x-1/2 select-none object-contain object-bottom brightness-95 saturate-[1.05] drop-shadow-[0_0_40px_rgba(124,92,232,0.5)]"
        src="/images/character.svg"
        alt="Hunter character"
      />
    </div>

    <!-- Stat sheet -->
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-[0.35rem]">
        <p class="m-0 text-[0.7rem] uppercase tracking-[0.32em] text-accent">[ status ]</p>
        <p class="m-0 text-[1.7rem] font-bold text-ink-soft">{{ player.name ?? 'Hunter' }}</p>
        <p class="m-0 text-[0.9rem] text-ink-dim">Rank <span class="inline-grid h-[1.4rem] w-[1.4rem] place-items-center rounded-[0.35rem] bg-accent font-extrabold text-white">{{ player.rank }}</span> · Level {{ player.level }}</p>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex justify-between text-[0.85rem] text-ink-muted">
          <span>XP</span>
          <span>{{ player.progress.current }} / {{ player.xpForNext }}</span>
        </div>
        <XpBar :percent="player.xpPct" />
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div class="flex flex-col gap-[0.2rem] rounded-[8px] border border-line bg-[rgba(26,17,64,0.6)] p-[0.85rem] text-center"><span class="text-[1.5rem] font-bold text-ink">{{ activeCount }}</span><span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Active quests</span></div>
        <div class="flex flex-col gap-[0.2rem] rounded-[8px] border border-line bg-[rgba(26,17,64,0.6)] p-[0.85rem] text-center"><span class="text-[1.5rem] font-bold text-ink">{{ player.todayCount }}</span><span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Due today</span></div>
        <div class="flex flex-col gap-[0.2rem] rounded-[8px] border border-danger-line bg-danger-bg/70 p-[0.85rem] text-center"><span class="text-[1.5rem] font-bold text-danger">{{ player.overdueCount }}</span><span class="text-[0.68rem] uppercase tracking-[0.05em] text-ink-muted">Overdue</span></div>
      </div>

      <section>
        <h2 class="mx-0 mb-[0.6rem] mt-0 text-[0.75rem] uppercase tracking-[0.18em] text-[#6a5da0]">Achievements</h2>
        <p class="m-0 text-[0.85rem] text-line-soft">— Coming soon —</p>
      </section>

      <!-- Sign out only on mobile — on desktop it lives in the persistent nav rail. -->
      <button
        type="button"
        class="mt-auto inline-flex min-h-[44px] w-full items-center justify-center rounded-[8px] border border-line bg-transparent px-4 py-2 text-[0.85rem] font-semibold text-ink-dim font-[inherit] transition-colors enabled:hover:border-danger-line enabled:hover:text-danger disabled:cursor-not-allowed disabled:opacity-60 md:hidden"
        :disabled="loggingOut"
        @click="onSignOut"
      >
        {{ loggingOut ? 'Signing out…' : 'Sign out' }}
      </button>
    </div>
  </div>
</template>
