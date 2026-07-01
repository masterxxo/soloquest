<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { usePlayerStore } from '~/stores/player';
import { useQuestsStore } from '~/stores/quests';
import { useFeedbackStore } from '~/stores/feedback';
import { signOut } from '~/lib/auth-client';

const route = useRoute();
const player = usePlayerStore();
const quests = useQuestsStore();
const feedback = useFeedbackStore();

// Session stays the source of truth; the player store is a projection of session.user.
// Hydration lives in the persistent layout so it survives page navigation.
const { data: session } = await useAuthSession();
watchEffect(() => player.hydrate(session.value?.user));

// Load the shared per-user lists once (client-side; the store guards re-fetches).
onMounted(() => { quests.load(); });

const tabs = [
  { to: '/',          label: 'Quests',    icon: 'quests' },
  { to: '/campaigns', label: 'Campaigns', icon: 'campaigns' },
  { to: '/rituals',   label: 'Rituals',   icon: 'rituals' },
  { to: '/status',    label: 'Status',    icon: 'status' },
  { to: '/glossary',  label: 'Glossary',  icon: 'glossary', soon: true },
  { to: '/items',     label: 'Items',     icon: 'items',    soon: true },
];
const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to);

const loggingOut = ref(false);
async function onSignOut() {
  loggingOut.value = true;
  await signOut();
  await refreshAuthSession();
  await navigateTo('/login');
}

// ── Pulsing edge of light around the book frame ────────────────────────────────
// Two light sources travel the perimeter at different speeds, in opposite directions,
// with an irregular brightness pulse. Values picked in the tuner — keep them.
const frame = ref<SVGSVGElement | null>(null);
const params = { intensity: 0.5, speed: 0.3, pulse: 0.45 };
let raf = 0;
let ro: ResizeObserver | null = null;

onMounted(() => {
  const svg = frame.value!;
  const box = svg.parentElement as HTMLElement;
  const rects = Array.from(svg.querySelectorAll('rect')) as SVGRectElement[];

  const size = () => {
    const w = box.clientWidth, h = box.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    rects.forEach(r => {
      r.setAttribute('x', '1'); r.setAttribute('y', '1');
      r.setAttribute('width', String(w - 2)); r.setAttribute('height', String(h - 2));
      r.setAttribute('rx', '10');
    });
  };
  size();
  ro = new ResizeObserver(size); ro.observe(box);

  const c1 = rects.filter(r => r.classList.contains('c1'));
  const c2 = rects.filter(r => r.classList.contains('c2'));
  let off1 = 0, off2 = 500, last = performance.now();

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const rate = (0.015 + params.speed * 0.10) * 1000;
    off1 = (off1 + rate * dt) % 1000;
    off2 = (off2 - rate * 0.73 * dt + 1000) % 1000;
    const t = now / 1000;
    const n = (Math.sin(t*0.9) + Math.sin(t*1.7+1) + Math.sin(t*2.3+2)) / 3;
    const mul = Math.max(0, 1 + params.pulse * 0.6 * n);
    c1.forEach(r => { r.setAttribute('stroke-dashoffset', String(-off1)); r.style.opacity = String(Math.min(1, +r.dataset.base! * params.intensity * mul)); });
    c2.forEach(r => { r.setAttribute('stroke-dashoffset', String(off2));  r.style.opacity = String(Math.min(1, +r.dataset.base! * params.intensity * mul * 0.85)); });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
});

onBeforeUnmount(() => { cancelAnimationFrame(raf); ro?.disconnect(); });
</script>

<template>
  <div class="flex min-h-screen w-full justify-center p-4 text-[#d0c8f8] md:p-8">
    <div class="flex w-full max-w-6xl items-stretch">

      <nav class="z-10 flex flex-col gap-1.5 pt-8">
        <NuxtLink
          v-for="t in tabs" :key="t.label"
          :to="t.soon ? '' : t.to"
          class="grimoire-tab flex items-center gap-2 rounded-l-lg border border-r-0 py-[9px] pl-[14px] pr-3 text-xs transition-[color,background] duration-200"
          :class="
            t.soon
              ? '-mr-px border-[#211a40] bg-[#100b22] pointer-events-none text-[#5a5080]'
              : isActive(t.to)
                ? '-mr-0.5 border-accent bg-accent text-white shadow-[-1px_0_0_#7c5ce8]'
                : '-mr-px border-line bg-[#181030] text-[#9d93c9] hover:bg-[#1e1540] hover:text-[#c9bdf0]'
          "
        >
          <GrimoireIcon :name="t.icon" />
          <span>{{ t.label }}</span>
        </NuxtLink>

        <button
          type="button"
          class="grimoire-tab -mr-px mt-[14px] flex cursor-pointer items-center gap-2 rounded-l-lg border border-r-0 border-line bg-[#120c26] py-[9px] pl-[14px] pr-3 text-left font-[inherit] text-xs text-[#7c6fa8] transition-[color,background] duration-200 enabled:hover:bg-[#1e1230] enabled:hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loggingOut"
          @click="onSignOut"
        >
          <GrimoireIcon name="items" class="invisible" />
          <span>{{ loggingOut ? 'Signing out…' : 'Sign out' }}</span>
        </button>
      </nav>

      <div class="relative flex-1 rounded-[12px] border-2 border-[#3a2d6e] bg-[#0a0618]">
        <svg ref="frame" class="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <filter id="grimoire-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
          </defs>
          <rect class="c1" data-base="0.42" pathLength="1000" fill="none" stroke="#b9a6ff" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="95 905" filter="url(#grimoire-glow)" />
          <rect class="c1" data-base="0.9"  pathLength="1000" fill="none" stroke="#e2d8ff" stroke-width="2"   stroke-linecap="round" stroke-dasharray="95 905" />
          <rect class="c2" data-base="0.36" pathLength="1000" fill="none" stroke="#8d6bff" stroke-width="6"   stroke-linecap="round" stroke-dasharray="65 935" filter="url(#grimoire-glow)" />
          <rect class="c2" data-base="0.8"  pathLength="1000" fill="none" stroke="#cdbcff" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="65 935" />
        </svg>

        <span class="absolute left-1.5 top-1.5 h-4 w-4 border-l-2 border-t-2 border-accent" />
        <span class="absolute right-1.5 top-1.5 h-4 w-4 border-r-2 border-t-2 border-accent" />
        <span class="absolute bottom-1.5 left-1.5 h-4 w-4 border-b-2 border-l-2 border-accent" />
        <span class="absolute bottom-1.5 right-1.5 h-4 w-4 border-b-2 border-r-2 border-accent" />

        <div class="relative m-1.5 flex h-[calc(100%-12px)] flex-col overflow-hidden rounded-[6px] border border-[#2a2050] p-5 md:p-6">
          <!-- Dryfująca mgła w środku strony (jak w modalach); dekoracyjna warstwa
               tła, treść nad nią dzięki `relative z-[1]`. -->
          <SmokeCanvas :density="1.5" :speed="0.6" />
          <header class="relative z-[1] flex items-center gap-3.5 border-b border-[#2a2050] pb-3.5">
            <div class="relative shrink-0">
              <div class="flex h-11 w-11 items-end justify-center overflow-hidden rounded-lg border border-[#7c5ce8] bg-[#1a1140]">
                <img src="/images/character.png" alt="" class="h-full w-full object-cover object-top" />
              </div>
              <span class="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-md border-2 border-[#070411] bg-[#7c5ce8] text-[11px] font-medium text-white">
                {{ player.rank }}
              </span>
            </div>
            <div class="flex-1">
              <div class="mb-1.5 text-[13px] text-[#efeaff]">
                {{ player.name ?? 'Hunter' }} · <span class="text-xs text-[#8a7fb5]">Level {{ player.level }}</span>
              </div>
              <div class="mb-1 flex justify-end text-[10px] text-[#8a7fb5]">{{ player.progress.current }} / {{ player.xpForNext }} XP</div>
              <div class="h-1.5 overflow-hidden rounded-full bg-[#1a1140]">
                <div class="h-full bg-[#7c5ce8] transition-[width] duration-500" :style="{ width: player.xpPct + '%' }" />
              </div>
            </div>
            <div class="flex gap-2">
              <div class="rounded-md bg-[#1a1140] px-2.5 py-1 text-center">
                <div class="text-sm font-medium text-[#d0c8f8]">{{ player.todayCount }}</div>
                <div class="text-[9px] text-[#8a7fb5]">DZIŚ</div>
              </div>
              <div class="rounded-md border border-[#5a2030] bg-[#2a1320] px-2.5 py-1 text-center">
                <div class="text-sm font-medium text-[#f0a0a0]">{{ player.overdueCount }}</div>
                <div class="text-[9px] text-[#c87a7a]">OVERDUE</div>
              </div>
            </div>
          </header>

          <main class="relative z-[1] mt-3.5 min-h-0 flex-1 overflow-y-auto">
            <slot />
          </main>
        </div>
      </div>
    </div>

    <!-- Global "System" feedback, above the persistent frame. -->
    <LevelUpToast :level="feedback.levelUpTo" />
    <RankWarningToast :warnings="feedback.warnings" />
    <AchievementToast :achievements="feedback.achievements" />
  </div>
</template>

<style scoped>
/* :deep sięga do <svg> renderowanego przez <GrimoireIcon> — Tailwind nie wyrazi
   selektora dzieciej biblioteki, więc zostaje jako CSS (klasa `grimoire-tab` na
   elemencie służy tu tylko jako hak dla tego selektora). */
.grimoire-tab :deep(svg) { width: 16px; height: 16px; flex-shrink: 0; }
</style>
