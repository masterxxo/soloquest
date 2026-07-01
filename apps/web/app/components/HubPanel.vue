<script setup lang="ts">
// Modal hub panel: dark frame with an animated energy border, decorative corners,
// a fixed head and an internally-scrolling body (passed via the default slot).
const props = defineProps<{
  title: string;
  origin?: { x: number; y: number } | null;
  // Panel width override (px). Defaults to the standard 540px frame.
  maxWidth?: number;
}>();
const emit = defineEmits<{ close: [] }>();

// Local visibility drives the open/close transition. The parent mounts us (open);
// on close we play the leave animation first and only emit `close` afterwards, so
// the parent's unmount doesn't cut it off (and the slot content stays put meanwhile).
const shown = ref(false);
onMounted(() => {
  shown.value = true; // false → true triggers the enter (grow) transition
  if (import.meta.client) document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = '';
});
function requestClose() {
  shown.value = false; // triggers the leave (shrink) transition
}

// The panel is flex-centred, so its final centre is the viewport centre. To make it
// grow from / shrink to the opening icon, the hidden state translates it by
// (origin - centre) and scales it down; the transition eases to/from centre.
const originStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.maxWidth) style['--sq-max-width'] = `${props.maxWidth}px`;
  if (import.meta.client && props.origin) {
    style['--sq-dx'] = `${props.origin.x - window.innerWidth / 2}px`;
    style['--sq-dy'] = `${props.origin.y - window.innerHeight / 2}px`;
  }
  return style;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="sq-overlay" @after-leave="emit('close')">
      <div v-if="shown" class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,3,12,0.75)] p-4 backdrop-blur-[4px]" @click.self="requestClose">
      <!-- Fractal-noise displacement filter: warps the border energy into an
           irregular, writhing shape rather than a clean rectangle outline. -->
      <svg class="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
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

        <!-- The `panel` class stays as a hook for ::before/::after (the border energy),
             the `.sq-overlay-* .panel` transition selectors and the media query — only the
             visual properties moved to utilities. -->
        <div
          class="panel relative flex max-h-[88vh] w-full max-w-[var(--sq-max-width,540px)] flex-col overflow-visible border border-line bg-[rgba(8,5,20,0.97)] p-9 shadow-[0_0_40px_rgba(124,92,232,0.25)]"
          :style="originStyle"
        >
          <SmokeCanvas :density="1.7" :speed="0.7" />
          <span class="absolute left-2 top-2 h-4 w-4 border-2 border-b-0 border-r-0 border-[#6a50c8]" />
          <span class="absolute right-2 top-2 h-4 w-4 border-2 border-b-0 border-l-0 border-[#6a50c8]" />
          <span class="absolute bottom-2 left-2 h-4 w-4 border-2 border-r-0 border-t-0 border-[#6a50c8]" />
          <span class="absolute bottom-2 right-2 h-4 w-4 border-2 border-l-0 border-t-0 border-[#6a50c8]" />

          <div class="relative z-[1] mb-7 flex flex-none items-center justify-between">
            <span class="text-[13px] uppercase tracking-[0.22em] text-accent">{{ title }}</span>
            <div class="flex items-center gap-[0.6rem]">
              <slot name="actions" />
              <button
                class="cursor-pointer border-0 bg-transparent font-[inherit] text-[0.95rem] font-semibold text-ink-muted hover:text-ink"
                type="button"
                @click="requestClose"
              >✕ Close</button>
            </div>
          </div>

          <div class="relative z-[1] min-h-0 flex-auto overflow-y-auto">
            <div class="flex flex-col gap-[1.1rem]"><slot /></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
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
/* Two conic-gradient segments, each masked to a thin ring just outside the panel
   (over the backdrop showing through), travelling the border at uneven speeds.
   The displacement filter roughens them into an unstable energy flow. */
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
/* Primary strand. */
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

/* Open/close: the overlay backdrop fades while the panel grows from / shrinks to
   the opening icon. One transition on the overlay drives both — the panel scale via
   a descendant selector — so the leave isn't cut off by the parent's unmount.
   The hidden state translates the shrunk panel onto the click point (origin). */
.sq-overlay-enter-active { transition: opacity 0.28s ease; }
.sq-overlay-leave-active { transition: opacity 0.26s ease; }
.sq-overlay-enter-from,
.sq-overlay-leave-to { opacity: 0; }

.sq-overlay-enter-active .panel {
  transition: transform 0.34s cubic-bezier(0.18, 0.82, 0.25, 1);
}
.sq-overlay-leave-active .panel {
  transition: transform 0.26s cubic-bezier(0.5, 0, 0.75, 0.3);
}
.sq-overlay-enter-from .panel,
.sq-overlay-leave-to .panel {
  transform: translate(var(--sq-dx, 0px), var(--sq-dy, 0px)) scale(0.05);
}

@media (prefers-reduced-motion: reduce) {
  .panel::before,
  .panel::after {
    animation: none;
  }
  .panel::after {
    opacity: 0;
  }
  .sq-overlay-enter-active,
  .sq-overlay-leave-active,
  .sq-overlay-enter-active .panel,
  .sq-overlay-leave-active .panel {
    transition: none;
  }
  .sq-overlay-enter-from .panel,
  .sq-overlay-leave-to .panel {
    transform: none;
  }
}
</style>
