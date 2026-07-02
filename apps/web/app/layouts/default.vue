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
// The mobile bottom bar shows only the 4 primary tabs; the stubs (Glossary/Items) are
// omitted while they're still placeholders.
const mobileTabs = tabs.filter((t) => !t.soon);
const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to);

// Sign out lives in the desktop rail; on mobile (rail hidden) it moves to the Status page.
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
  <!-- Fixed height + overflow-hidden: the book doesn't grow with content — scrolling
       happens inside the content section. On mobile pb-[76px] leaves room above the
       bottom nav bar; md:p-8 clears that reserve on desktop. -->
  <div class="flex h-[100dvh] w-full justify-center overflow-hidden p-3 pb-[76px] text-ink md:p-8">
    <div class="flex h-full w-full max-w-6xl items-stretch">

      <!-- Navigation: vertical rail (desktop only). -->
      <nav class="z-10 hidden flex-col gap-1.5 pt-8 md:flex">
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

      <div class="relative flex h-full min-h-0 flex-1 flex-col gap-2 rounded-[12px] border-2 border-line-strong bg-panel p-2 md:gap-3 md:p-3">
        <!-- Drifting fog behind both sections (like the modals); a decorative background
             layer under the pulsing edge, with content above it via `relative`. -->
        <SmokeCanvas :density="1.5" :speed="0.6" />
        <svg ref="frame" class="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible">
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

        <!-- Section 1: header (cartouche) — fixed height, doesn't scroll. -->
        <section class="relative z-[1] shrink-0 rounded-[6px] border border-line p-3 md:p-5">
          <FrameCorners />
          <div class="flex items-center gap-3 md:gap-3.5">
            <div class="relative shrink-0">
              <div class="flex h-10 w-10 items-end justify-center overflow-hidden rounded-lg border border-accent bg-[#1a1140] md:h-11 md:w-11">
                <img src="/images/character.png" alt="" class="h-full w-full object-cover object-top" />
              </div>
              <span class="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-md border-2 border-app bg-accent text-[11px] font-medium text-white">
                {{ player.rank }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="mb-1.5 truncate text-[13px] text-ink-bright">
                {{ player.name ?? 'Hunter' }} · <span class="text-xs text-ink-dim">Level {{ player.level }}</span>
              </div>
              <div class="mb-1 flex justify-end text-[10px] text-ink-dim">{{ player.progress.current }} / {{ player.xpForNext }} XP</div>
              <div class="h-1.5 overflow-hidden rounded-full bg-[#1a1140]">
                <div class="h-full bg-accent transition-[width] duration-500" :style="{ width: player.xpPct + '%' }" />
              </div>
            </div>
            <div class="flex shrink-0 gap-1.5 md:gap-2">
              <div class="rounded-md bg-[#1a1140] px-2 py-1 text-center md:px-2.5">
                <div class="text-sm font-medium text-ink">{{ player.todayCount }}</div>
                <div class="text-[9px] text-ink-dim">TODAY</div>
              </div>
              <div class="rounded-md border border-danger-line bg-danger-bg px-2 py-1 text-center md:px-2.5">
                <div class="text-sm font-medium text-danger">{{ player.overdueCount }}</div>
                <div class="text-[9px] text-[#c87a7a]">OVERDUE</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 2: content — scrolls inside this section, the page doesn't grow. -->
        <section class="relative z-[1] min-h-0 flex-1 rounded-[6px] border border-line">
          <FrameCorners />
          <div class="h-full overflow-y-auto p-4 md:p-5">
            <slot />
          </div>
        </section>
      </div>
    </div>

    <!-- Navigation: bottom bar (mobile only). Active tab highlighted in the accent color. -->
    <nav class="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-panel/95 px-2 py-1.5 backdrop-blur md:hidden">
      <NuxtLink
        v-for="t in mobileTabs" :key="t.label"
        :to="t.to"
        class="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] transition-colors"
        :class="isActive(t.to) ? 'text-accent-light' : 'text-ink-dim'"
      >
        <GrimoireIcon :name="t.icon" class="h-5 w-5" />
        <span>{{ t.label }}</span>
      </NuxtLink>
    </nav>

    <!-- Global "System" feedback, above the persistent frame. -->
    <LevelUpToast :level="feedback.levelUpTo" />
    <RankWarningToast :warnings="feedback.warnings" />
    <AchievementToast :achievements="feedback.achievements" />
  </div>
</template>

<style scoped>
/* :deep reaches into the <svg> rendered by <GrimoireIcon> — Tailwind can't express a
   selector into a child component, so it stays as CSS (the `grimoire-tab` class on the
   element only serves as a hook for this selector). */
.grimoire-tab :deep(svg) { width: 16px; height: 16px; flex-shrink: 0; }
</style>
