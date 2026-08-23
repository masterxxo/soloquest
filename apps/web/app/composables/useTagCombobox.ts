import { toValue, type MaybeRefOrGetter, type Ref } from 'vue';

// Shared listbox behaviour for the tag combobox (form + quick-add) and the filter
// popover — so their keyboard model and the Escape handling stay identical (the user learns
// it once). Each caller owns its own options, rendering and selection semantics; this only
// runs the open/highlight/keyboard state over an options array.
export function useTagCombobox<T>(params: {
  query: Ref<string>;
  options: MaybeRefOrGetter<readonly T[]>;
  // Commit the highlighted (or clicked) option — pin a tag, toggle a filter, create one.
  select: (option: T) => void;
  // Optional: Backspace on an empty input (the combobox unpins its last chip).
  backspaceOnEmpty?: () => void;
}) {
  const open = ref(false);
  const activeIndex = ref(0);
  const optionList = () => toValue(params.options);

  // Keep the highlight in range as the option list shrinks/grows (typing, selecting).
  watch(optionList, () => {
    if (activeIndex.value >= optionList().length) {
      activeIndex.value = Math.max(0, optionList().length - 1);
    }
  });

  function openList() {
    open.value = true;
    activeIndex.value = 0;
  }
  function close() {
    open.value = false;
  }

  function onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open.value) openList();
        else activeIndex.value = Math.min(activeIndex.value + 1, optionList().length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        activeIndex.value = Math.max(0, activeIndex.value - 1);
        break;
      case 'Enter': {
        const option = optionList()[activeIndex.value];
        if (option !== undefined) {
          event.preventDefault();
          params.select(option);
        } else if (params.query.value.trim()) {
          // Swallow Enter while typing so it never submits an enclosing form.
          event.preventDefault();
        }
        break;
      }
      case 'Escape':
        // First Escape closes only this dropdown/popover — swallow it so the global
        // modalStack Escape (a window-level listener) doesn't also fire and close the modal
        // or navigate away. With it already closed, Escape is left to bubble as usual.
        if (open.value) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        break;
      case 'Backspace':
        if (params.query.value === '' && params.backspaceOnEmpty) {
          event.preventDefault();
          params.backspaceOnEmpty();
        }
        break;
    }
  }

  return { open, activeIndex, openList, close, onKeydown };
}
