import { defineStore } from 'pinia';

// Global registry of open modals, kept as a STACK in open order — the order matters so
// Escape can close only the top-most one (the last opened), not all at once.
//
// It lives in a Pinia store rather than a shared-state composable for two reasons: the
// existing composables (useEntityModals / useModalOrigin) are per-instance factories with
// no shared state, so there's no precedent for a singleton composable here; and every
// genuinely global piece of UI state in this app (player, quests, feedback) is already a
// store. Pinia also gives per-request isolation, so the stack can't leak across SSR
// requests the way module-scoped composable state would.

// One entry per open modal. `close` runs that modal's own close path (leave animation +
// unmount), so popping the stack goes through exactly the same route as clicking ✕.
export interface ModalStackEntry {
  id: number;
  close: () => void;
}

// Monotonic id source, kept outside reactive state — a plain handle, not UI data (mirrors
// how the feedback store keeps its timer handles module-scoped).
let nextModalId = 0;

export const useModalStackStore = defineStore('modalStack', {
  state: () => ({ stack: [] as ModalStackEntry[] }),
  getters: {
    hasOpenModal: (state): boolean => state.stack.length > 0,
    topModal: (state): ModalStackEntry | null => state.stack[state.stack.length - 1] ?? null,
  },
  actions: {
    // Called by a modal when it opens; returns a stable id to unregister with.
    registerModal(close: () => void): number {
      const id = nextModalId++;
      this.stack.push({ id, close });
      return id;
    },
    // Called when a modal closes by ANY route (backdrop, ✕, Escape, programmatic close,
    // or unmount on navigation). Idempotent: unregistering an id already gone is a no-op.
    unregisterModal(id: number) {
      const i = this.stack.findIndex((m) => m.id === id);
      if (i !== -1) this.stack.splice(i, 1);
    },
    // Close only the top-most modal. Returns whether there was one to close, so the Escape
    // shortcut knows whether to swallow the key or let it pass through.
    closeTop(): boolean {
      const top = this.stack[this.stack.length - 1];
      if (!top) return false;
      top.close();
      return true;
    },
  },
});
