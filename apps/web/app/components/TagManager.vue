<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useTagsStore } from '~/stores/tags';
import { useQuestsStore } from '~/stores/quests';
import { TAG_NAME_MAX_LENGTH, TAG_COLORS, type TagColor } from '@soloquest/shared';
import { tagSwatchStyle } from '~/lib/tag-colors';

// Tag management: list the user's tags (usage counts), and rename/recolour/delete each in one
// modal — three actions on one object, so they share a single interaction model (per the
// design ruling). Reads/writes the shared tags store; after a change it patches the quests
// store so already-loaded cards update without a refetch.
const tagsStore = useTagsStore();
const quests = useQuestsStore();
const { sortedTags } = storeToRefs(tagsStore);
onMounted(() => { tagsStore.load(); });

const palette = TAG_COLORS;

const editingId = ref<string | null>(null);
const editName = ref('');
const editColor = ref<TagColor>('amethyst');
const editError = ref<string | null>(null);
const saving = ref(false);
const confirming = ref(false);

const editingTag = computed(() => sortedTags.value.find((t) => t.id === editingId.value) ?? null);

function openEdit(id: string, name: string, color: TagColor) {
  editingId.value = id;
  editName.value = name;
  editColor.value = color;
  editError.value = null;
}
function closeEdit() {
  editingId.value = null;
  confirming.value = false;
}

async function save() {
  const tag = editingTag.value;
  if (!tag) return;
  const name = editName.value.trim();
  if (!name) {
    editError.value = 'Name cannot be empty.';
    return;
  }
  saving.value = true;
  editError.value = null;
  try {
    if (name !== tag.name) {
      const error = await tagsStore.renameTag(tag.id, name);
      if (error) {
        editError.value = error;
        return;
      }
      quests.renameTagEverywhere(tag.id, name);
    }
    if (editColor.value !== tag.color) {
      if (await tagsStore.setColor(tag.id, editColor.value)) quests.recolorTagEverywhere(tag.id, editColor.value);
    }
    closeEdit();
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  const tag = editingTag.value;
  if (!tag) return;
  saving.value = true;
  try {
    if (await tagsStore.deleteTag(tag.id)) quests.removeTagEverywhere(tag.id);
    closeEdit();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-2 border-b border-dl-band-line pb-1">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Tags</span>
      <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ sortedTags.length }}</span>
    </div>

    <p v-if="!sortedTags.length" class="m-0 text-dl-body text-dl-ink-muted">
      No tags yet. Tags are created while writing a quest; this is where they're renamed, recoloured and removed.
    </p>

    <ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
      <li
        v-for="tag in sortedTags"
        :key="tag.id"
        class="flex items-center gap-3 border border-dl-hairline bg-dl-surface px-3 py-2"
      >
        <TagChip :name="tag.name" :color="tag.color" />
        <span class="ml-auto font-dl-mono text-dl-label text-dl-ink-faint">{{ tag.usageCount }} {{ tag.usageCount === 1 ? 'quest' : 'quests' }}</span>
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
          @click="openEdit(tag.id, tag.name, tag.color)"
        >Edit</button>
      </li>
    </ul>

    <!-- Edit: rename + recolour, with delete reachable from here. -->
    <DlModal v-if="editingTag && !confirming" title="Edit tag" @close="closeEdit">
      <div class="flex flex-col gap-5">
        <label class="flex flex-col gap-1.5">
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Name</span>
          <input
            v-model="editName"
            type="text"
            :maxlength="TAG_NAME_MAX_LENGTH"
            class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none"
            @keydown.enter.prevent="save"
          />
          <span class="font-dl-mono text-dl-label text-dl-ink-faint">Renaming updates the tag on all {{ editingTag.usageCount }} {{ editingTag.usageCount === 1 ? 'quest' : 'quests' }} at once.</span>
        </label>

        <div class="flex flex-col gap-2">
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Colour · 15 palette options</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in palette"
              :key="color"
              type="button"
              class="dl-focus-outset h-7 w-7 cursor-pointer border"
              :class="color === editColor ? 'border-dl-ink' : 'border-dl-hairline'"
              :style="tagSwatchStyle(color)"
              :aria-label="color"
              :aria-pressed="color === editColor"
              @click="editColor = color"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Preview</span>
          <TagChip :name="editName || editingTag.name" :color="editColor" />
        </div>

        <p v-if="editError" class="m-0 text-dl-meta text-dl-magenta">{{ editError }}</p>
      </div>

      <template #footer>
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-magenta bg-transparent px-3 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-magenta hover:bg-dl-magenta/10"
          @click="confirming = true"
        >Delete tag</button>
        <div class="flex-1" />
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
          @click="closeEdit"
        >Cancel</button>
        <button
          type="button"
          :disabled="saving"
          class="dl-focus-inset cursor-pointer bg-dl-violet px-4 py-2 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
          @click="save"
        >{{ saving ? 'Saving…' : 'Save changes' }}</button>
      </template>
    </DlModal>

    <!-- Delete confirmation: magenta chrome, magenta-outlined primary (never a filled button). -->
    <DlModal v-if="editingTag && confirming" title="Delete tag" tone="danger" @close="confirming = false">
      <div class="flex flex-col gap-3">
        <p class="m-0 flex gap-2 border border-dl-magenta bg-dl-magenta/10 px-3 py-2 text-dl-body text-dl-ink">
          <span aria-hidden="true" class="text-dl-magenta">!</span>
          Remove "{{ editingTag.name }}" from {{ editingTag.usageCount }} {{ editingTag.usageCount === 1 ? 'quest' : 'quests' }}?
        </p>
        <p class="m-0 text-dl-meta text-dl-ink-muted">The quests themselves are untouched — they simply lose this tag, including the ones already recorded in Chronicles. The tag cannot be restored, and re-creating it starts a new usage count at zero.</p>
      </div>
      <template #footer>
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
          @click="confirming = false"
        >Keep tag</button>
        <button
          type="button"
          :disabled="saving"
          class="dl-focus-inset cursor-pointer border border-dl-magenta bg-transparent px-4 py-2 font-dl-mono text-dl-label uppercase tracking-wide text-dl-magenta hover:bg-dl-magenta/10 disabled:opacity-60"
          @click="confirmDelete"
        >{{ saving ? 'Deleting…' : 'Delete tag' }}</button>
      </template>
    </DlModal>
  </section>
</template>
