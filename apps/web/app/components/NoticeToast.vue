<script setup lang="ts">
import type { NoticeVariant } from '~/stores/feedback';

// "System"-style notice feedback — the one generic toast for short-lived messages.
// Shown while there are messages; the parent (the feedback store) owns the auto-hide
// timer and the layout's toast container owns the position. `warning` is amber (something
// to fix, e.g. rank warnings); `info` is neutral accent (a statement of fact, e.g. a
// ritual already completed today) so it never reads as the player's mistake.
const props = withDefaults(
  defineProps<{ messages: string[]; variant?: NoticeVariant }>(),
  { variant: 'warning' },
);

const VARIANTS: Record<NoticeVariant, { box: string; label: string; text: string; icon: string }> = {
  warning: {
    box: 'border-gold shadow-[0_0_30px_rgba(240,180,41,0.55),inset_0_0_18px_rgba(240,180,41,0.2)]',
    label: 'text-gold',
    text: 'text-[#f7d774] [text-shadow:0_0_10px_rgba(240,180,41,0.6)]',
    icon: '⚠ ',
  },
  info: {
    box: 'border-accent shadow-[0_0_30px_rgba(124,92,232,0.45),inset_0_0_18px_rgba(124,92,232,0.18)]',
    label: 'text-accent-soft',
    text: 'text-ink-bright [text-shadow:0_0_10px_rgba(124,92,232,0.55)]',
    icon: '',
  },
};

const style = computed(() => VARIANTS[props.variant]);
</script>

<template>
  <Transition name="notice">
    <div
      v-if="messages.length"
      class="pointer-events-auto max-w-full shrink-0 border bg-[rgba(8,5,20,0.95)] px-8 py-4 text-center backdrop-blur-[6px]"
      :class="style.box"
      role="status"
      aria-live="polite"
    >
      <p class="mb-[0.35rem] text-[0.65rem] tracking-[0.3em]" :class="style.label">[ SYSTEM ]</p>
      <p
        v-for="(m, i) in messages"
        :key="i"
        class="my-[0.15rem] text-[0.85rem] font-semibold"
        :class="style.text"
      >
        {{ style.icon }}{{ m }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
/* Vue transition classes (<Transition name="notice">) — Nuxt/Vue attaches them
   dynamically, so they can't be expressed as utilities; kept as CSS. */
.notice-enter-active, .notice-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.notice-enter-from, .notice-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
