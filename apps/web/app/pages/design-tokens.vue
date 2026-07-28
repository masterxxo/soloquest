<script setup lang="ts">
// TEMPORARY control surface for the "Daylight" redesign token layer (step 1 of 4).
// Dev-only — it renders every token so the new system can be eyeballed before any component
// adopts it. Scheduled for removal in step 4. It deliberately uses the literal `dl-*` Tailwind
// classes so a missing or misspelled token breaks visibly here rather than silently downstream.
import { TAG_COLORS, TAG_COLOR_HEX } from '@soloquest/shared';
import { tagChipStyle, tagSwatchStyle } from '~/lib/tag-colors';

// Not a real route in production.
if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}

definePageMeta({ layout: false });

// Reference hexes — shown as captions next to each swatch (the swatch colour itself comes
// from the Tailwind `dl-*` class, so caption vs. fill mismatch would reveal a bad token).
const surfaces = [
  { name: 'bg', hex: '#F2F1F7' },
  { name: 'surface', hex: '#FFFFFF' },
  { name: 'sunk', hex: '#E9E7F2' },
];
const lines = [
  { name: 'grid-line', hex: '#C9C3DE' },
  { name: 'band-line', hex: '#8F87B0' },
  { name: 'hairline', hex: '#DDD9EC' },
];
const text = [
  { name: 'ink', hex: '#14111F' },
  { name: 'ink-muted', hex: '#6A6683' },
  { name: 'ink-faint', hex: '#A6A1BE' },
];
const accent = [
  { name: 'violet', hex: '#5B2FE0' },
  { name: 'violet-hot', hex: '#7C5CE8' },
  { name: 'violet-wash', hex: '#EFEAFF' },
];
const signals = [
  { name: 'cyan', hex: '#00C2D9' },
  { name: 'magenta', hex: '#FF2E63' },
  { name: 'lime', hex: '#B8F02E' },
  { name: 'gold', hex: '#FFB020' },
];
</script>

<template>
  <main class="min-h-screen bg-dl-bg px-dl-gutter py-12 font-dl-sans text-dl-ink">
    <div class="mx-auto flex max-w-5xl flex-col gap-12">
      <header class="flex flex-col gap-2">
        <h1 class="m-0 font-dl-display text-dl-title font-semibold">Daylight — design tokens</h1>
        <p class="m-0 text-dl-body text-dl-ink-muted">
          Dev-only control surface (step 1 of 4). Every token below is rendered from its
          Tailwind <code class="font-dl-mono">dl-*</code> class.
        </p>
      </header>

      <!-- Colours ------------------------------------------------------------------------ -->
      <section class="flex flex-col gap-6">
        <h2 class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.18em] text-dl-ink-muted">Colours</h2>

        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-dl-meta text-dl-ink-muted">surfaces</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="s in surfaces" :key="s.name" class="flex flex-col gap-1">
              <div class="h-16 w-32 rounded border border-dl-hairline" :class="{ 'bg-dl-bg': s.name === 'bg', 'bg-dl-surface': s.name === 'surface', 'bg-dl-sunk': s.name === 'sunk' }" />
              <span class="font-dl-mono text-dl-label text-dl-ink">dl-{{ s.name }}</span>
              <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ s.hex }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-dl-meta text-dl-ink-muted">lines</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="l in lines" :key="l.name" class="flex flex-col gap-1">
              <div class="h-16 w-32 rounded" :class="{ 'bg-dl-grid-line': l.name === 'grid-line', 'bg-dl-band-line': l.name === 'band-line', 'bg-dl-hairline': l.name === 'hairline' }" />
              <span class="font-dl-mono text-dl-label text-dl-ink">dl-{{ l.name }}</span>
              <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ l.hex }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-dl-meta text-dl-ink-muted">text</h3>
          <div class="flex flex-wrap gap-6">
            <div v-for="t in text" :key="t.name" class="flex flex-col gap-1">
              <span class="text-dl-title" :class="{ 'text-dl-ink': t.name === 'ink', 'text-dl-ink-muted': t.name === 'ink-muted', 'text-dl-ink-faint': t.name === 'ink-faint' }">The quick brown fox</span>
              <span class="font-dl-mono text-dl-label text-dl-ink">dl-{{ t.name }}</span>
              <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ t.hex }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-dl-meta text-dl-ink-muted">accent</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="a in accent" :key="a.name" class="flex flex-col gap-1">
              <div class="h-16 w-32 rounded border border-dl-hairline" :class="{ 'bg-dl-violet': a.name === 'violet', 'bg-dl-violet-hot': a.name === 'violet-hot', 'bg-dl-violet-wash': a.name === 'violet-wash' }" />
              <span class="font-dl-mono text-dl-label text-dl-ink">dl-{{ a.name }}</span>
              <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ a.hex }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-dl-meta text-dl-ink-muted">signals</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="sig in signals" :key="sig.name" class="flex flex-col gap-1">
              <div class="h-16 w-32 rounded" :class="{ 'bg-dl-cyan': sig.name === 'cyan', 'bg-dl-magenta': sig.name === 'magenta', 'bg-dl-lime': sig.name === 'lime', 'bg-dl-gold': sig.name === 'gold' }" />
              <span class="font-dl-mono text-dl-label text-dl-ink">dl-{{ sig.name }}</span>
              <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ sig.hex }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="m-0 text-dl-meta text-dl-ink-muted">ranks (S is inverted)</h3>
          <div class="flex flex-wrap gap-3">
            <RankBadge v-for="r in ['E', 'D', 'C', 'B', 'A', 'S']" :key="r" :rank="r" />
          </div>
        </div>
      </section>

      <!-- Type scale ---------------------------------------------------------------------- -->
      <section class="flex flex-col gap-4">
        <h2 class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.18em] text-dl-ink-muted">Type scale</h2>
        <p class="m-0 font-dl-mono text-dl-numeral text-dl-ink">1 234<span class="ml-4 text-dl-label text-dl-ink-faint">numeral · 30 · mono</span></p>
        <p class="m-0 font-dl-display text-dl-title text-dl-ink">Rise through the ranks<span class="ml-4 font-dl-mono text-dl-label text-dl-ink-faint">title · 22 · display</span></p>
        <p class="m-0 text-dl-body text-dl-ink">Complete a quest to earn XP.<span class="ml-4 font-dl-mono text-dl-label text-dl-ink-faint">body · 14 · sans</span></p>
        <p class="m-0 text-dl-meta text-dl-ink-muted">Due in 3 days<span class="ml-4 font-dl-mono text-dl-label text-dl-ink-faint">meta · 12 · sans</span></p>
        <p class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.14em] text-dl-ink-muted">Overdue<span class="ml-4 normal-case tracking-normal text-dl-ink-faint">label · 11 · mono</span></p>
      </section>

      <!-- Row heights --------------------------------------------------------------------- -->
      <section class="flex flex-col gap-4">
        <h2 class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.18em] text-dl-ink-muted">Row heights</h2>
        <div class="flex flex-col gap-2">
          <div class="flex h-dl-row items-center rounded border border-dl-hairline bg-dl-surface px-4 text-dl-body text-dl-ink">task row · h-dl-row · 56px</div>
          <div class="flex h-dl-subrow items-center rounded border border-dl-hairline bg-dl-surface px-4 text-dl-meta text-dl-ink-muted">sub-task row (pointer) · h-dl-subrow · 40px</div>
          <div class="flex h-dl-subrow-touch items-center rounded border border-dl-hairline bg-dl-surface px-4 text-dl-meta text-dl-ink-muted">sub-task row (touch) · h-dl-subrow-touch · 44px</div>
          <div class="inline-flex min-h-dl-touch min-w-dl-touch items-center justify-center self-start rounded border border-dl-hairline bg-dl-surface px-4 text-dl-meta text-dl-ink-muted">min touch target · 44×44</div>
        </div>
      </section>

      <!-- Corner cuts --------------------------------------------------------------------- -->
      <section class="flex flex-col gap-4">
        <h2 class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.18em] text-dl-ink-muted">Corner cut</h2>
        <div class="flex flex-wrap items-end gap-6">
          <div class="corner-cut flex h-24 w-40 items-center justify-center bg-dl-violet-wash text-dl-meta text-dl-ink">corner-cut · 12px</div>
          <div class="corner-cut-sm flex h-12 w-24 items-center justify-center bg-dl-violet-wash text-dl-meta text-dl-ink">-sm · 6px</div>
        </div>
      </section>

      <!-- Focus rings --------------------------------------------------------------------- -->
      <section class="flex flex-col gap-4">
        <h2 class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.18em] text-dl-ink-muted">Focus ring</h2>
        <p class="m-0 text-dl-meta text-dl-ink-muted">Tab into these to see the ring.</p>
        <div class="flex flex-col gap-3">
          <button type="button" class="dl-focus-inset flex h-dl-row items-center rounded border border-dl-hairline bg-dl-surface px-4 text-left text-dl-body text-dl-ink">
            dl-focus-inset — 2px violet, offset −2px (full-width rows)
          </button>
          <button type="button" class="dl-focus-outset inline-flex min-h-dl-touch items-center self-start rounded border border-dl-hairline bg-dl-surface px-4 text-dl-body text-dl-ink">
            dl-focus-outset — 2px violet, offset +2px (standalone cells)
          </button>
        </div>
      </section>

      <!-- Motion -------------------------------------------------------------------------- -->
      <section class="flex flex-col gap-4">
        <h2 class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.18em] text-dl-ink-muted">Motion</h2>
        <p class="m-0 text-dl-meta text-dl-ink-muted">Hover a chip — all use <code class="font-dl-mono">ease-dl</code>. Disabled under reduced motion.</p>
        <div class="flex flex-wrap gap-3">
          <span class="ease-dl duration-dl-micro rounded bg-dl-sunk px-3 py-2 text-dl-meta text-dl-ink transition-transform hover:-translate-y-1">micro · 120ms</span>
          <span class="ease-dl duration-dl-standard rounded bg-dl-sunk px-3 py-2 text-dl-meta text-dl-ink transition-transform hover:-translate-y-1">standard · 200ms</span>
          <span class="ease-dl duration-dl-panel rounded bg-dl-sunk px-3 py-2 text-dl-meta text-dl-ink transition-transform hover:-translate-y-1">panel · 280ms</span>
          <span class="ease-dl duration-dl-sweep rounded bg-dl-sunk px-3 py-2 text-dl-meta text-dl-ink transition-transform hover:-translate-y-1">sweep · 400ms</span>
        </div>
      </section>

      <!-- Tag palette --------------------------------------------------------------------- -->
      <section class="flex flex-col gap-4">
        <h2 class="m-0 font-dl-mono text-dl-label uppercase tracking-[0.18em] text-dl-ink-muted">Tag palette (15)</h2>
        <p class="m-0 text-dl-meta text-dl-ink-muted">Fill 10% · full-colour outline · full-colour dot · ink label.</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="color in TAG_COLORS"
            :key="color"
            class="inline-flex items-center gap-[0.4rem] rounded-[3px] border px-[0.5rem] py-[0.15rem] text-dl-meta"
            :style="tagChipStyle(color)"
          >
            <span class="h-[0.55rem] w-[0.55rem] flex-none rounded-full" :style="tagSwatchStyle(color)" />
            {{ color }}
            <span class="font-dl-mono text-dl-label opacity-70">{{ TAG_COLOR_HEX[color] }}</span>
          </span>
        </div>
      </section>
    </div>
  </main>
</template>
