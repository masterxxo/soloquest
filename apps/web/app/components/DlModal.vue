<script lang="ts">
import { useModalStackStore } from '~/stores/modalStack';

// Module-scoped so stacked modals ref-count the body scroll lock together — released only
// once the last one closes.
let lockCount = 0;
function lockBodyScroll() {
  if (import.meta.client && lockCount++ === 0) document.body.style.overflow = 'hidden';
}
function unlockBodyScroll() {
  if (import.meta.client && --lockCount === 0) document.body.style.overflow = '';
}
</script>

<script setup lang="ts">
// The Daylight modal chrome — one pattern for every dialog (Rituals form/detail, Quest
// form/detail, tag edit/delete). White surface, 1px grid-line edge, corner cut; a 60px header
// band (mono-caps title + a 4px violet square, plus a 44px close); a scrolling body that grows
// a band-line on its scrolled edge; and an optional footer band (secondary left of primary).
// On mobile it drops to a bottom sheet capped at 88vh with the footer above the safe area.
//
// Behaviour matches the old HubPanel: it registers on the global modal stack (so Escape closes
// the top-most one), locks body scroll while open, animates from the opening control's origin,
// and returns focus to that control on close. Focus is trapped inside while open.
const props = withDefaults(
  defineProps<{
    title: string;
    origin?: { x: number; y: number } | null;
    maxWidth?: number;
    // Magenta header dot + intent for destructive dialogs (delete confirmations).
    tone?: 'default' | 'danger';
  }>(),
  { origin: null, maxWidth: 560, tone: 'default' },
);
const emit = defineEmits<{ close: [] }>();

const shown = ref(false);
const panelEl = ref<HTMLElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);
const scrolled = ref(false);

// The control that opened us — focus returns here on close.
const opener = import.meta.client ? (document.activeElement as HTMLElement | null) : null;

const modalStack = useModalStackStore();
let modalId: number | null = null;

onMounted(() => {
  shown.value = true;
  lockBodyScroll();
  modalId = modalStack.registerModal(requestClose);
  nextTick(() => {
    const first = focusables()[0];
    (first ?? panelEl.value)?.focus();
  });
});
onBeforeUnmount(() => {
  unlockBodyScroll();
  if (modalId !== null) modalStack.unregisterModal(modalId);
  opener?.focus?.();
});
function requestClose() {
  shown.value = false;
}

function focusables(): HTMLElement[] {
  if (!panelEl.value) return [];
  return Array.from(
    panelEl.value.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);
}
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab') return;
  const f = focusables();
  if (!f.length) return;
  const first = f[0]!;
  const last = f[f.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

const originStyle = computed(() => {
  const style: Record<string, string> = { '--dl-mw': `${props.maxWidth}px` };
  if (import.meta.client && props.origin) {
    style['--dl-dx'] = `${props.origin.x - window.innerWidth / 2}px`;
    style['--dl-dy'] = `${props.origin.y - window.innerHeight / 2}px`;
  }
  return style;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="dl-overlay" @after-leave="emit('close')">
      <div
        v-if="shown"
        class="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,17,31,0.62)] md:items-center md:p-4"
        @click.self="requestClose"
      >
        <div
          ref="panelEl"
          class="dl-panel corner-cut relative flex max-h-[88vh] w-full max-w-[var(--dl-mw,560px)] flex-col border border-dl-grid-line bg-dl-surface outline-none"
          :style="originStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <!-- Header band -->
          <header class="flex h-[60px] flex-none items-center gap-2 border-b border-dl-band-line px-5">
            <span
              class="h-1 w-1 shrink-0"
              :class="tone === 'danger' ? 'bg-dl-magenta' : 'bg-dl-violet'"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink">{{ title }}</span>
            <slot name="actions" />
            <button
              type="button"
              class="dl-focus-inset grid h-11 w-11 shrink-0 -mr-2 cursor-pointer place-items-center border-0 bg-transparent text-dl-ink-muted hover:text-dl-ink"
              aria-label="Close"
              @click="requestClose"
            >✕</button>
          </header>

          <!-- Body -->
          <div
            ref="bodyEl"
            class="min-h-0 flex-1 overflow-y-auto px-5 py-5"
            :class="scrolled ? 'border-t border-dl-band-line' : ''"
            @scroll="scrolled = ($event.target as HTMLElement).scrollTop > 0"
          >
            <slot />
          </div>

          <!-- Footer band (optional) -->
          <footer
            v-if="$slots.footer"
            class="flex h-[68px] flex-none items-center justify-end gap-3 border-t border-dl-band-line px-5 pb-[env(safe-area-inset-bottom)]"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dl-overlay-enter-active { transition: opacity 0.24s ease; }
.dl-overlay-leave-active { transition: opacity 0.2s ease; }
.dl-overlay-enter-from,
.dl-overlay-leave-to { opacity: 0; }

.dl-overlay-enter-active .dl-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.dl-overlay-leave-active .dl-panel {
  transition: transform 0.2s cubic-bezier(0.5, 0, 0.75, 0.3);
}
.dl-overlay-enter-from .dl-panel,
.dl-overlay-leave-to .dl-panel {
  transform: translate(var(--dl-dx, 0px), var(--dl-dy, 0px)) scale(0.05);
}

@media (prefers-reduced-motion: reduce) {
  .dl-overlay-enter-active,
  .dl-overlay-leave-active,
  .dl-overlay-enter-active .dl-panel,
  .dl-overlay-leave-active .dl-panel { transition: none; }
  .dl-overlay-enter-from .dl-panel,
  .dl-overlay-leave-to .dl-panel { transform: none; }
}
</style>
