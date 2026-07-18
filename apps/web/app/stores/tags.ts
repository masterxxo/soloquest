import { defineStore } from 'pinia';
import { client, type TagWithUsage } from '~/lib/api-client';
import type { TagColor } from '@soloquest/shared';

// Single client-side cache of the user's tags (with usage counts). Shared by the tag picker
// in the quest form (its search source + on-the-fly create), the filter popover, and the
// Status tag manager — so all three read and mutate one list rather than each fetching.
//
// usageCount is server-derived and counts EVERY existing quest carrying a tag (any status).
// It only changes when quest↔tag pins change (quest create/update/delete or on-the-fly
// create), never on completion — so `stale` is flipped from exactly those paths via
// invalidate(), and the next load() refetches. See stores/quests.ts for the call sites.
interface TagsState {
  tags: TagWithUsage[];
  loaded: boolean;
  // Cache is loaded but a quest↔tag mutation may have moved a usageCount since; the next
  // load() (e.g. on entering Status) refetches instead of trusting the cached counts.
  stale: boolean;
}

const byName = (a: TagWithUsage, b: TagWithUsage) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export const useTagsStore = defineStore('tags', {
  state: (): TagsState => ({ tags: [], loaded: false, stale: false }),
  getters: {
    sortedTags: (state): TagWithUsage[] => state.tags,
  },
  actions: {
    // Fetch when not yet loaded, when marked stale, or when forced. The single place counts
    // become fresh again — no ad-hoc refetch scattered in components.
    async load(options?: { force?: boolean }) {
      if (this.loaded && !this.stale && !options?.force) return;
      const res = await client.api.tags.$get().catch(() => null);
      if (res?.ok) {
        this.tags = await res.json();
        this.loaded = true;
        this.stale = false;
      }
    },

    // Mark the usage counts as possibly-out-of-date. Cheap and idempotent; the refetch is
    // deferred to the next load() (typically the next time Status mounts).
    invalidate() {
      this.stale = true;
    },

    // Create a tag (or get the existing one on a normalized-name collision — the backend
    // returns 200 either way, with a deterministic colour when we send none). Folds the
    // result into the cache and returns it so the caller (the picker) can immediately pin it.
    async createTag(name: string): Promise<TagWithUsage | null> {
      const res = await client.api.tags.$post({ json: { name } });
      if (!res.ok) return null;
      const tag = await res.json();
      const existing = this.tags.find((t) => t.id === tag.id);
      if (existing) return existing;
      const entry: TagWithUsage = { ...tag, usageCount: 0 };
      this.tags = [...this.tags, entry].sort(byName);
      return entry;
    },

    // Rename in place. Returns the server error message on collision (409) so the manager can
    // show it; null on success. Colour is untouched.
    async renameTag(id: string, name: string): Promise<string | null> {
      const res = await client.api.tags[':id'].$patch({ param: { id }, json: { name } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return body?.error ?? 'Could not rename tag.';
      }
      const updated = await res.json();
      this.tags = this.tags
        .map((t) =>
          t.id === id ? { ...t, name: updated.name, normalizedName: updated.normalizedName } : t,
        )
        .sort(byName);
      return null;
    },

    // Recolour in place (name/pins untouched). Returns whether it stuck.
    async setColor(id: string, color: TagColor): Promise<boolean> {
      const res = await client.api.tags[':id'].$patch({ param: { id }, json: { color } });
      if (!res.ok) return false;
      const updated = await res.json();
      this.tags = this.tags.map((t) => (t.id === id ? { ...t, color: updated.color } : t));
      return true;
    },

    async deleteTag(id: string): Promise<boolean> {
      const res = await client.api.tags[':id'].$delete({ param: { id } });
      if (!res.ok) return false;
      this.tags = this.tags.filter((t) => t.id !== id);
      return true;
    },
  },
});
