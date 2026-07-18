<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useTagsStore } from '~/stores/tags';
import { useQuestsStore } from '~/stores/quests';
import { TAG_NAME_MAX_LENGTH, TAG_COLORS, type TagColor } from '@soloquest/shared';
import { tagSwatchStyle } from '~/lib/tag-colors';

// Minimal tag management: list the user's tags with usage counts, rename inline, delete with
// a confirm that spells out how many quests are affected. Reads/writes the shared tags store;
// after a rename or delete it also patches the quests store so already-loaded cards update
// without a refetch.
const tagsStore = useTagsStore();
const quests = useQuestsStore();
const { sortedTags } = storeToRefs(tagsStore);

onMounted(() => { tagsStore.load(); });

// One row at a time is either being renamed, awaiting delete-confirm, or picking a colour;
// ids keep it simple. The palette is the canonical order from shared.
const palette = TAG_COLORS;
const editingId = ref<string | null>(null);
const draftName = ref('');
const editError = ref<string | null>(null);
const savingId = ref<string | null>(null);
const confirmingId = ref<string | null>(null);
const coloringId = ref<string | null>(null);

function startEdit(id: string, name: string) {
  confirmingId.value = null;
  coloringId.value = null;
  editingId.value = id;
  draftName.value = name;
  editError.value = null;
}

function toggleColorGrid(id: string) {
  editingId.value = null;
  confirmingId.value = null;
  coloringId.value = coloringId.value === id ? null : id;
}

async function pickColor(id: string, color: TagColor) {
  if (await tagsStore.setColor(id, color)) quests.recolorTagEverywhere(id, color);
  coloringId.value = null;
}

function cancelEdit() {
  editingId.value = null;
  draftName.value = '';
  editError.value = null;
}

async function saveEdit(id: string) {
  const name = draftName.value.trim();
  if (!name) {
    editError.value = 'Name cannot be empty.';
    return;
  }
  savingId.value = id;
  editError.value = null;
  try {
    const error = await tagsStore.renameTag(id, name);
    if (error) {
      editError.value = error;
      return;
    }
    quests.renameTagEverywhere(id, name);
    cancelEdit();
  } finally {
    savingId.value = null;
  }
}

async function confirmDelete(id: string) {
  savingId.value = id;
  try {
    if (await tagsStore.deleteTag(id)) quests.removeTagEverywhere(id);
    confirmingId.value = null;
  } finally {
    savingId.value = null;
  }
}
</script>

<template>
  <section>
    <h2 class="mx-0 mb-[0.6rem] mt-0 text-[0.75rem] uppercase tracking-[0.18em] text-[#6a5da0]">Tags</h2>

    <p v-if="!sortedTags.length" class="m-0 text-[0.85rem] text-line-soft">
      No tags yet. Add them to a quest to start organising.
    </p>

    <ul v-else class="m-0 flex list-none flex-col gap-[0.4rem] p-0">
      <li
        v-for="tag in sortedTags"
        :key="tag.id"
        class="flex flex-col gap-[0.4rem] rounded-none border border-line bg-[rgba(26,17,64,0.4)] px-[0.7rem] py-[0.5rem]"
      >
        <!-- Rename mode -->
        <div v-if="editingId === tag.id" class="flex flex-col gap-[0.4rem]">
          <div class="flex items-center gap-2">
            <input
              v-model="draftName"
              type="text"
              :maxlength="TAG_NAME_MAX_LENGTH"
              class="min-w-0 flex-1 rounded-none border border-line bg-panel px-[0.6rem] py-[0.4rem] text-[0.85rem] text-ink-soft outline-none font-[inherit] focus:border-accent focus:shadow-[0_0_0_2px_rgba(124,92,232,0.3)]"
              :disabled="savingId === tag.id"
              @keydown.enter.prevent="saveEdit(tag.id)"
              @keydown.esc.stop.prevent="cancelEdit()"
            />
            <button
              type="button"
              class="flex-none cursor-pointer border border-accent bg-accent/12 px-[0.6rem] py-[0.4rem] text-[0.78rem] font-semibold text-ink font-[inherit] hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="savingId === tag.id"
              @click="saveEdit(tag.id)"
            >
              Save
            </button>
            <button
              type="button"
              class="flex-none cursor-pointer border border-line bg-transparent px-[0.6rem] py-[0.4rem] text-[0.78rem] font-semibold text-ink-dim font-[inherit] hover:border-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="savingId === tag.id"
              @click="cancelEdit()"
            >
              Cancel
            </button>
          </div>
          <p v-if="editError" class="m-0 text-[0.75rem] text-danger-bright">{{ editError }}</p>
        </div>

        <!-- Delete-confirm mode: name the blast radius before removing. -->
        <div v-else-if="confirmingId === tag.id" class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[0.85rem] text-ink">
            Delete "{{ tag.name }}"?
            <span class="text-ink-dim">Used on {{ tag.usageCount }} quest{{ tag.usageCount === 1 ? '' : 's' }}.</span>
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="cursor-pointer border border-[#5a2740] bg-transparent px-[0.6rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger-bright font-[inherit] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="savingId === tag.id"
              @click="confirmDelete(tag.id)"
            >
              Delete
            </button>
            <button
              type="button"
              class="cursor-pointer border border-line bg-transparent px-[0.6rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink-dim font-[inherit] hover:border-line-soft hover:text-ink"
              @click="confirmingId = null"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Default row -->
        <div v-else class="flex flex-col gap-[0.4rem]">
          <div class="flex items-center justify-between gap-2">
            <!-- Colour swatch: toggles the palette grid below. -->
            <button
              type="button"
              class="h-[0.95rem] w-[0.95rem] flex-none cursor-pointer rounded-full border border-line/60"
              :style="tagSwatchStyle(tag.color)"
              :aria-label="`Change colour of ${tag.name}`"
              :aria-expanded="coloringId === tag.id"
              @click="toggleColorGrid(tag.id)"
            />
            <span class="min-w-0 flex-1 truncate text-[0.9rem] text-ink-soft">{{ tag.name }}</span>
            <span class="flex-none text-[0.75rem] text-ink-muted">
              {{ tag.usageCount }} quest{{ tag.usageCount === 1 ? '' : 's' }}
            </span>
            <div class="flex flex-none items-center gap-1">
              <button
                type="button"
                class="cursor-pointer border border-line bg-transparent px-[0.5rem] py-[0.3rem] text-[0.75rem] font-semibold text-ink font-[inherit] hover:border-accent"
                @click="startEdit(tag.id, tag.name)"
              >
                Rename
              </button>
              <button
                type="button"
                class="cursor-pointer border border-[#5a2740] bg-transparent px-[0.5rem] py-[0.3rem] text-[0.75rem] font-semibold text-danger-bright font-[inherit] hover:brightness-110"
                aria-label="Delete tag"
                @click="confirmingId = tag.id; coloringId = null"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Palette grid: 15 canonical colours; click applies (PATCH) and closes. -->
          <div v-if="coloringId === tag.id" class="flex flex-wrap gap-[0.35rem] pt-[0.15rem]">
            <button
              v-for="color in palette"
              :key="color"
              type="button"
              class="h-[1.2rem] w-[1.2rem] cursor-pointer rounded-full border"
              :class="color === tag.color ? 'border-ink' : 'border-line/40 hover:border-line-soft'"
              :style="tagSwatchStyle(color)"
              :aria-label="color"
              :aria-pressed="color === tag.color"
              @click="pickColor(tag.id, color)"
            />
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
