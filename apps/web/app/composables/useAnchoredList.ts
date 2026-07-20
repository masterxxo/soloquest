import type { Ref } from 'vue';

// Positions a combobox's suggestion list as a fixed-position layer anchored to its field,
// so opening the list never changes the height of the form or the modal around it — an
// in-flow list would push everything below it down. Fixed + viewport coordinates also
// escapes the modal body's `overflow-y-auto`, which would otherwise clip an `absolute` list.
//
// The list is expected to be teleported to <body> and given the returned `anchoredStyle`.
// The style is recomputed on scroll/resize (and visual-viewport changes, for the mobile
// keyboard) while open, and the list flips above the field when there isn't room below.
// Listeners are attached only while open and torn down on close/unmount.

const MAX_HEIGHT = 264; // px — cap on the list height; also the "is there room below?" threshold
const MIN_HEIGHT = 120; // px — never squeeze the list below this; flip instead
const GAP = 4; // px between the field and the list

export function useAnchoredList(anchor: Ref<HTMLElement | null>, open: Ref<boolean>) {
  const anchoredStyle = ref<Record<string, string>>({});

  // Visible region in layout-viewport coordinates. getBoundingClientRect() is in the same
  // frame, and position:fixed also resolves against the layout viewport, so the three agree.
  // visualViewport narrows the region when the mobile keyboard is up.
  function viewport() {
    const vv = import.meta.client ? window.visualViewport : null;
    const top = vv?.offsetTop ?? 0;
    const height = vv?.height ?? (import.meta.client ? window.innerHeight : 0);
    return { top, bottom: top + height };
  }

  function update() {
    const el = anchor.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vp = viewport();
    const spaceBelow = vp.bottom - rect.bottom - GAP;
    const spaceAbove = rect.top - vp.top - GAP;
    // Flip up only when there isn't room below AND there's more room above.
    const flipUp = spaceBelow < MAX_HEIGHT && spaceAbove > spaceBelow;
    const available = Math.max(MIN_HEIGHT, flipUp ? spaceAbove : spaceBelow);
    anchoredStyle.value = {
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.min(MAX_HEIGHT, available)}px`,
      ...(flipUp
        ? { bottom: `${(import.meta.client ? window.innerHeight : 0) - rect.top + GAP}px` }
        : { top: `${rect.bottom + GAP}px` }),
    };
  }

  // Re-anchor when the field itself changes size — e.g. a chip wraps onto a new line and
  // pushes the field's bottom edge down while the list is open.
  let observer: ResizeObserver | null = null;

  function attach() {
    // Capture phase so a scroll in the modal body (a nested scroll container) triggers it too.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    if (anchor.value && 'ResizeObserver' in window) {
      observer = new ResizeObserver(update);
      observer.observe(anchor.value);
    }
  }
  function detach() {
    window.removeEventListener('scroll', update, true);
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
    observer?.disconnect();
    observer = null;
  }

  watch(open, (isOpen) => {
    if (!import.meta.client) return;
    if (isOpen) {
      nextTick(update);
      attach();
    } else {
      detach();
    }
  });

  onBeforeUnmount(() => {
    if (import.meta.client) detach();
  });

  return { anchoredStyle };
}
