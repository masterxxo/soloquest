export type ModalOrigin = { x: number; y: number } | null;

// Viewport point a modal grows out of — the centre of the element that opened it.
// Shared by the pages that animate HubPanel modals from their trigger.
export function useModalOrigin() {
  function originFrom(event?: MouseEvent): ModalOrigin {
    const el = event?.currentTarget;
    if (el instanceof HTMLElement) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return null;
  }

  return { originFrom };
}
