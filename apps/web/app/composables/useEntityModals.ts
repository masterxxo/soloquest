import type { Ref } from 'vue';
import { useModalOrigin, type ModalOrigin } from '~/composables/useModalOrigin';

// Shared create/detail/edit modal orchestration for a list page. Owns only the thin,
// mechanical part both the Quests and Rituals pages repeat: the three modals' open
// state plus the viewport origin each animates from. Entity-specific glue (which store
// method a completion/edit calls, how an open detail is kept in sync) stays in the page
// — this composable deliberately doesn't try to absorb it.
//
// TDetail is the shape held by the detail modal; TEdit the shape passed to the edit
// modal (they differ for rituals: the detail carries streak fields, the edit form a
// bare row), defaulting to TDetail when the two match (quests).
export function useEntityModals<TDetail, TEdit = TDetail>() {
  const { originFrom } = useModalOrigin();

  // Create modal — simple visibility toggle.
  const showCreate = ref(false);
  const createOrigin = ref<ModalOrigin>(null);
  function openCreate(event?: MouseEvent) {
    createOrigin.value = originFrom(event);
    showCreate.value = true;
  }
  function closeCreate() {
    showCreate.value = false;
  }

  // Detail modal — holds the selected entity (null = closed).
  const selected = ref(null) as Ref<TDetail | null>;
  const detailOrigin = ref<ModalOrigin>(null);
  function openDetail(item: TDetail, event?: MouseEvent) {
    detailOrigin.value = originFrom(event);
    selected.value = item;
  }
  function closeDetail() {
    selected.value = null;
  }

  // Edit modal — holds the entity being edited (null = closed). Stacks over the detail.
  const editing = ref(null) as Ref<TEdit | null>;
  const editOrigin = ref<ModalOrigin>(null);
  function openEdit(item: TEdit, event?: MouseEvent) {
    editOrigin.value = originFrom(event);
    editing.value = item;
  }
  function closeEdit() {
    editing.value = null;
  }

  return {
    showCreate,
    createOrigin,
    openCreate,
    closeCreate,
    selected,
    detailOrigin,
    openDetail,
    closeDetail,
    editing,
    editOrigin,
    openEdit,
    closeEdit,
  };
}
