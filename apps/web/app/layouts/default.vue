<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import { useQuestsStore } from '~/stores/quests';
import { useSignOut } from '~/composables/useSignOut';
import { useModalStackStore } from '~/stores/modalStack';
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts';

const route = useRoute();
const player = usePlayerStore();
const quests = useQuestsStore();

// Session stays the source of truth; the player store is a projection of session.user.
// Hydration lives in the persistent layout so it survives page navigation.
const { data: session } = await useAuthSession();
watchEffect(() => player.hydrate(session.value?.user));

// Load the shared per-user lists once (client-side; the store guards re-fetches).
onMounted(() => { quests.load(); });

const tabs = [
  { to: '/',           label: 'Quests',     icon: 'quests' },
  { to: '/rituals',    label: 'Rituals',    icon: 'rituals' },
  { to: '/chronicles', label: 'Chronicles', icon: 'chronicles' },
  { to: '/status',     label: 'Status',     icon: 'status' },
  { to: '/glossary',   label: 'Glossary',   icon: 'glossary', soon: true },
  { to: '/items',      label: 'Items',      icon: 'items',    soon: true },
];
// The mobile bottom bar shows only the 4 primary tabs; the stubs (Glossary/Items) are
// omitted while they're still placeholders.
const mobileTabs = tabs.filter((t) => !t.soon);
const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to);

// Sign out lives in the desktop gutter; on mobile (gutter hidden) it moves to the Status page.
const { loggingOut, onSignOut } = useSignOut();

// Global Escape → close the top-most modal. Registered in the persistent layout so it works
// on every page; it reads the global modal stack, pops one entry per press (nested modals
// close one at a time), and does nothing when nothing is open. allowInInput so Escape still
// closes a modal while a form field inside it holds focus.
const modalStack = useModalStackStore();
useKeyboardShortcuts([
  {
    key: 'Escape',
    description: 'Close the current modal',
    allowInInput: true,
    handler: (event) => {
      if (modalStack.closeTop()) event.preventDefault();
    },
  },
]);
</script>

<template>
  <!-- Daylight shell — a 1px `dl-grid-line` frame to the edges with cut corners. Two layers:
       the outer holds the frame line (a grid-line fill + 1px padding), the inner is the app
       surface, both clipped by `corner-cut` so the bevel is drawn cleanly. Scroll pattern
       (unchanged from the grimoire shell): the frame is h-[100dvh] + overflow-hidden, the
       min-h-0 chain runs down to a SINGLE overflow-y-auto in the content region, so the shell
       never grows with content — the gutter, telemetry bar and mobile nav stay pinned. -->
  <div class="corner-cut flex h-[100dvh] w-full overflow-hidden bg-dl-grid-line p-px text-dl-ink">
    <div class="corner-cut flex min-h-0 w-full flex-1 bg-dl-bg">

      <!-- Navigation: vertical gutter (desktop only), 88px. Brand marker on top, then six
           tabs (Glossary/Items are disabled stubs), then Sign out at the bottom. Active tab:
           violet-wash fill + a violet bar on the leading edge. The gutter shares the frame's
           `dl-bg` fill (a `dl-band-line` divider separates it) so the frame's cut corners never
           clip a lighter surface into a stray triangle — only the 1px bevel line remains. -->
      <aside class="hidden w-dl-gutter shrink-0 flex-col border-r border-dl-band-line bg-dl-bg md:flex">
        <!-- Brand marker — anchors the top of the rail. White "S" on violet is 7.2:1 (AA). -->
        <div class="flex justify-center py-4">
          <span class="corner-cut-sm flex h-10 w-10 items-center justify-center bg-dl-violet font-dl-display text-dl-title font-bold text-white">S</span>
        </div>

        <nav class="flex flex-col">
          <NuxtLink
            v-for="t in tabs" :key="t.label"
            :to="t.soon ? '' : t.to"
            class="relative flex flex-col items-center gap-1.5 py-3.5 font-dl-mono text-dl-label uppercase tracking-wide transition-colors duration-dl-standard ease-dl"
            :class="
              t.soon
                ? 'pointer-events-none text-dl-ink-faint'
                : isActive(t.to)
                  ? 'bg-dl-violet-wash text-dl-violet'
                  : 'text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink'
            "
          >
            <span v-if="!t.soon && isActive(t.to)" class="absolute inset-y-0 left-0 w-0.5 bg-dl-violet" />
            <NavIcon :name="t.icon" class="h-5 w-5" />
            <span>{{ t.label }}</span>
          </NuxtLink>
        </nav>

        <button
          type="button"
          class="mt-auto flex flex-col items-center gap-1.5 py-3.5 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted transition-colors duration-dl-standard ease-dl enabled:hover:bg-dl-sunk enabled:hover:text-dl-magenta disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loggingOut"
          @click="onSignOut"
        >
          <NavIcon name="signout" class="h-5 w-5" />
          <span>{{ loggingOut ? 'Signing out…' : 'Sign out' }}</span>
        </button>
      </aside>

      <!-- Main column: telemetry bar (fixed) + scrolling content + mobile nav (fixed). -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">

        <!-- Telemetry bar — reads the player store (the old cartouche). It never scrolls.
             Two groups pushed to opposite edges (justify-between): the LEFT group is a compact
             run of portrait · LV · XP · RANK; the RIGHT group hugs TODAY · OVERDUE to the far
             edge. The elastic gap sits between them, so the XP bar keeps a fixed width instead
             of stretching the whole bar. -->
        <header class="flex shrink-0 items-center justify-between gap-4 border-b border-dl-band-line bg-dl-surface px-3 py-2.5 md:px-6 md:py-3">

          <!-- LEFT group: portrait · LV · XP · RANK. -->
          <div class="flex min-w-0 items-center gap-3 md:gap-4">
            <!-- Portrait thumbnail — secondary, max 56px, in a cut frame. -->
            <div class="corner-cut-sm hidden h-11 w-11 shrink-0 overflow-hidden bg-dl-sunk sm:block md:h-14 md:w-14">
              <img src="/images/character.svg" alt="" class="h-full w-full object-cover object-top" />
            </div>

            <!-- Level (Chakra Petch, large). -->
            <div class="flex shrink-0 flex-col leading-none">
              <span class="font-dl-mono text-dl-label uppercase text-dl-ink-muted">Level</span>
              <span class="font-dl-display text-dl-numeral font-semibold leading-none text-dl-ink">{{ player.level }}</span>
            </div>

            <!-- XP — fixed width (~300px), not full-bleed; ink digits, cyan fill only. min-w-0
                 lets it shrink on narrow screens rather than overflow. -->
            <div class="w-[300px] min-w-0 shrink">
              <div class="mb-1 flex items-baseline justify-between font-dl-mono text-dl-label uppercase text-dl-ink-muted">
                <span>XP</span>
                <span class="normal-case text-dl-ink">{{ player.progress.current }} / {{ player.xpForNext }}</span>
              </div>
              <div class="h-1.5 overflow-hidden bg-dl-sunk">
                <div class="h-full bg-dl-cyan transition-[width] duration-dl-sweep ease-dl" :style="{ width: player.xpPct + '%' }" />
              </div>
            </div>

            <!-- Player rank marker — to the RIGHT of the XP bar.
                 player.rank is a cosmetic level→letter mapping in the player store.
                 TODO: rankFromLevel — thresholds not finalized -->
            <span class="corner-cut-sm inline-flex h-7 w-7 shrink-0 items-center justify-center bg-dl-violet-wash font-dl-display text-dl-body font-semibold text-dl-violet">{{ player.rank }}</span>
          </div>

          <!-- RIGHT group: TODAY / OVERDUE counters, pinned to the right edge. -->
          <div class="flex shrink-0 items-center gap-3 md:gap-4">
            <div class="text-center">
              <div class="font-dl-display text-dl-title font-semibold leading-none text-dl-ink">{{ player.todayCount }}</div>
              <div class="mt-1 font-dl-mono text-dl-label uppercase text-dl-ink-muted">Today</div>
            </div>
            <div class="text-center">
              <div class="font-dl-display text-dl-title font-semibold leading-none text-dl-magenta">{{ player.overdueCount }}</div>
              <div class="mt-1 font-dl-mono text-dl-label uppercase text-dl-ink-muted">Overdue</div>
            </div>
          </div>
        </header>

        <!-- Content — the ONLY scroll container in the shell. The page grows here; the frame
             does not. min-h-0 above lets flex-1 actually shrink so overflow-y-auto engages. -->
        <main class="min-h-0 flex-1">
          <div class="h-full overflow-y-auto p-4 md:p-6">
            <slot />
          </div>
        </main>

        <!-- Navigation: bottom bar (mobile only). Four primary tabs; in-flow (not fixed) so it
             sits below the scroll region and honours the safe-area inset on notched devices. -->
        <nav class="flex shrink-0 border-t border-dl-band-line bg-dl-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          <NuxtLink
            v-for="t in mobileTabs" :key="t.label"
            :to="t.to"
            class="flex min-h-dl-touch flex-1 flex-col items-center justify-center gap-1 py-2 font-dl-mono text-dl-label uppercase tracking-wide transition-colors"
            :class="isActive(t.to) ? 'text-dl-violet' : 'text-dl-ink-muted'"
          >
            <NavIcon :name="t.icon" class="h-5 w-5" />
            <span>{{ t.label }}</span>
          </NuxtLink>
        </nav>
      </div>
    </div>
  </div>
</template>
