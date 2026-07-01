<script setup lang="ts">
// Organic animated smoke rendered on a <canvas>. Soft radial-gradient particles
// drift upward, steered by a 3D simplex-noise vector field, so the motion reads as
// curling haze rather than uniform rising. Purely decorative — pointer-events: none.
import { createNoise3D } from 'simplex-noise';

const props = withDefaults(
  defineProps<{
    // Multiplier on particle opacity/density (smoke A).
    density?: number;
    // Multiplier on animation speed (noise field evolution).
    speed?: number;
  }>(),
  { density: 1.0, speed: 1.0 },
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animFrame: number;
let t = 0;

onMounted(() => {
  // Respect reduced-motion: render nothing and never start the rAF loop.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const canvas = canvasRef.value!;
  const ctx = canvas.getContext('2d')!;
  const noise3D = createNoise3D();

  // Drawing-buffer size = the element's CSS size. Returns false when the element has no
  // dimensions yet. In production the container height (dynamic — flex, calc()) is often
  // computed only after hydration, so a one-shot measure produced a 0x0 buffer and nothing
  // rendered (Status worked because it has a fixed min-h).
  let sized = false;
  function measure() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (!w || !h) return false;
    canvas.width = w;
    canvas.height = h;
    sized = true;
    return true;
  }
  measure();

  // Smoke particle parameters.
  const PARTICLE_COUNT = 120;
  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    life: number;
    maxLife: number;
  };

  function spawnParticle(): Particle {
    const x = Math.random() * canvas.width;
    // Spawn from the bottom 1/3 of the canvas.
    const y = canvas.height * (0.65 + Math.random() * 0.35);
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.3 + Math.random() * 0.5),
      size: 60 + Math.random() * 120,
      opacity: 0,
      life: 0,
      maxLife: 180 + Math.random() * 240,
    };
  }

  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, spawnParticle);
  // Stagger initial life so particles don't all appear/fade in unison.
  particles.forEach((p) => {
    p.life = Math.random() * p.maxLife;
  });

  // Re-measure reactively instead of only on mount/`window resize`: when the container
  // gets its real height only after mounting, the ResizeObserver ensures the canvas never
  // gets stuck with a 0x0 buffer. On the first valid measurement, re-scatter the particles
  // (until now they spawned against the canvas's default 300x150).
  const ro = new ResizeObserver(() => {
    const wasSized = sized;
    if (measure() && !wasSized) {
      particles.forEach((p) => {
        Object.assign(p, spawnParticle());
        p.life = Math.random() * p.maxLife;
      });
    }
  });
  ro.observe(canvas);

  function tick() {
    t += 0.003 * props.speed;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.life++;
      if (p.life > p.maxLife) {
        Object.assign(p, spawnParticle());
        p.life = 0;
      }

      // Noise-driven drift — the particle follows a slowly-evolving vector field.
      const nx = noise3D(p.x * 0.003, p.y * 0.003, t);
      const ny = noise3D(p.x * 0.003 + 100, p.y * 0.003 + 100, t);
      p.vx += nx * 0.06;
      p.vy += ny * 0.04 - 0.02; // slight updraft
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.x += p.vx;
      p.y += p.vy;

      // Fade in over the first 1/4 of life, fade out over the last 1/4.
      const progress = p.life / p.maxLife;
      let alpha: number;
      if (progress < 0.25) {
        alpha = progress / 0.25;
      } else if (progress > 0.75) {
        alpha = (1 - progress) / 0.25;
      } else {
        alpha = 1;
      }

      // Max opacity scales with the density prop and Y position
      // (denser near the bottom, thinner toward the top).
      const yFactor = Math.max(0, p.y / canvas.height);
      const maxOpacity = 0.055 * props.density * (0.4 + yFactor * 0.6);

      // Draw as a soft radial-gradient blob.
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      grad.addColorStop(0, `rgba(130, 100, 220, ${alpha * maxOpacity})`);
      grad.addColorStop(0.4, `rgba(100, 70, 190, ${alpha * maxOpacity * 0.6})`);
      grad.addColorStop(1, `rgba(60, 30, 140, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    animFrame = requestAnimationFrame(tick);
  }

  tick();

  onBeforeUnmount(() => {
    cancelAnimationFrame(animFrame);
    ro.disconnect();
  });
});
</script>

<template>
  <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 block h-full w-full">
    <!-- CSS size also drives the drawing-buffer resolution (offsetWidth/Height). -->
  </canvas>
</template>
