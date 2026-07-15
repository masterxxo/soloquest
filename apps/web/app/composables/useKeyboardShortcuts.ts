import { onScopeDispose } from 'vue';

// A single keyboard shortcut, registered declaratively. `description` is unused for now
// but is here on purpose: a future help screen ("?") will list every shortcut from it.
export interface KeyboardShortcut {
  // The bare key to match against `event.key`, compared case-insensitively (e.g. 'q', '?').
  key: string;
  // Receives the raw event so it can `preventDefault()` when it acts on the key.
  handler: (event: KeyboardEvent) => void;
  description: string;
  // Fire even while a text field is focused. Off by default (a shortcut like `q` must not
  // steal a keystroke the user is typing); on for keys that mean "cancel/close" inside a
  // field, e.g. Escape.
  allowInInput?: boolean;
}

// One central place to register global keyboard shortcuts. The guards that decide whether
// a keystroke is "meant for us" live here once, so every shortcut passed in inherits them
// for free — the callers only describe intent, never re-check focus or modifiers.
//
// Registers a single `keydown` listener on `window` and tears it down when the calling
// scope (component setup) is disposed, so navigating between pages never leaks or
// double-registers a listener.
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  function onKeydown(event: KeyboardEvent) {
    // Auto-repeat: holding a key must fire the handler once, not on every repeat tick.
    if (event.repeat) return;

    // Modifier combos (Cmd+Q, Ctrl+Q, Alt+Q) belong to the browser/OS — never intercept
    // them. Bare Shift is allowed through: shifted keys like "?" are wanted later.
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.toLowerCase();
    const match = shortcuts.find((s) => s.key.toLowerCase() === key);
    if (!match) return;

    // The text-field guard is per-shortcut, applied only after a shortcut matches: `q` must
    // not hijack a keystroke the user is typing, but Escape (allowInInput) is the normal
    // "cancel/close" key inside a focused field and must still fire. Checked by tag/flag
    // rather than a focus-target allowlist so any editable element is covered.
    if (!match.allowInInput) {
      const el = event.target as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return;
      }
    }

    match.handler(event);
  }

  // `window` only exists client-side; the listener is a no-op during SSR.
  if (import.meta.client) {
    window.addEventListener('keydown', onKeydown);
    onScopeDispose(() => window.removeEventListener('keydown', onKeydown));
  }
}
