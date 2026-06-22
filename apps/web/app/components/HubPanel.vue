<script setup lang="ts">
// Modal hub panel: dark frame with an animated energy border, decorative corners,
// a fixed head and an internally-scrolling body (passed via the default slot).
const props = defineProps<{ title: string; origin?: { x: number; y: number } | null }>();
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
  if (!import.meta.client || !props.origin) return {};
  const dx = props.origin.x - window.innerWidth / 2;
  const dy = props.origin.y - window.innerHeight / 2;
  return { '--sq-dx': `${dx}px`, '--sq-dy': `${dy}px` };
});
</script>

<template>
  <Teleport to="body">
    <Transition name="sq-overlay" @after-leave="emit('close')">
      <div v-if="shown" class="overlay" @click.self="requestClose">
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

        <div class="panel" :style="originStyle">
          <span class="corner corner-tl" />
          <span class="corner corner-tr" />
          <span class="corner corner-bl" />
          <span class="corner corner-br" />

          <div class="panel-head">
            <span class="panel-title">{{ title }}</span>
            <div class="panel-actions">
              <slot name="actions" />
              <button class="panel-close" type="button" @click="requestClose">✕ Close</button>
            </div>
          </div>

          <div class="panel-scroll">
            <div class="panel-body"><slot /></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
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
/* Hidden host for the SVG filter definition — renders nothing itself. */
.sq-filter {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
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
.panel-actions { display: flex; align-items: center; gap: 0.6rem; }
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
