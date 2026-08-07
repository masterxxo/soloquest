import { defineStore } from 'pinia';
import { client, type TagWithUsage } from '~/lib/api-client';
import type { TagColor } from '@soloquest/shared';
import {
  isCacheFresh,
  LIST_CACHE_TTL_MS,
  readTagsListCache,
  writeTagsListCache,
} from '~/lib/list-cache';

// Single client-side cache of the user's tags (with usage counts). Shared by the tag picker
// in the quest form (its search source + on-the-fly create), the filter popover, and the
// Status tag manager — so all three read and mutate one list rather than each fetching.
//
// usageCount is server-derived and counts EVERY existing quest carrying a tag (any status).
// It only changes when quest↔tag pins change (quest create/update/delete or on-the-fly
// create), never on completion — so `stale` is flipped from exactly those paths via
// invalidate(), and the next load()/refresh refetches. See stores/quests.ts for the call sites.
//
// Persists to localStorage (same SWR loop as quests — see lib/list-cache.ts).
interface TagsState {
  tags: TagWithUsage[];
  loaded: boolean;
  loading: boolean;
  // Cache is loaded but a quest↔tag mutation may have moved a usageCount since; the next
  // load()/refresh refetches instead of trusting the cached counts.
  stale: boolean;
  fetchedAt: number | null;
  userId: string | null;
}

const byName = (a: TagWithUsage, b: TagWithUsage) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

let tagsRefreshInflight: Promise<void> | null = null;

export const useTagsStore = defineStore('tags', {
  state: (): TagsState => ({
    tags: [],
    loaded: false,
    loading: false,
    stale: false,
    fetchedAt: null,
    userId: null,
  }),
  getters: {
    sortedTags: (state): TagWithUsage[] => state.tags,
  },
  actions: {
    reset() {
      this.tags = [];
      this.loaded = false;
      this.loading = false;
      this.stale = false;
      this.fetchedAt = null;
      this.userId = null;
      tagsRefreshInflight = null;
    },

    hydrateFromCache() {
      if (!this.userId) return;
      const snap = readTagsListCache(this.userId);
      if (!snap) return;
      this.tags = snap.tags;
      this.loaded = true;
      this.fetchedAt = snap.fetchedAt;
      this.stale = false;
    },

    persist() {
      if (!this.userId || !this.loaded || this.fetchedAt == null) return;
      writeTagsListCache(this.userId, {
        fetchedAt: this.fetchedAt,
        tags: this.tags,
      });
    },

    async boot(userId: string) {
      if (this.userId !== userId) {
        this.reset();
        this.userId = userId;
      } else if (!this.userId) {
        this.userId = userId;
      }
      this.hydrateFromCache();
      await this.refresh();
    },

    // Fetch when not yet loaded, when marked stale, when forced, or when the TTL expired.
    async load(options?: { force?: boolean }) {
      if (!this.userId) return;
      if (!this.loaded) this.hydrateFromCache();
      if (options?.force || this.stale) {
        await this.refresh();
        return;
      }
      await this.refreshIfStale();
    },

    async refreshIfStale(maxAgeMs = LIST_CACHE_TTL_MS) {
      if (this.loaded && !this.stale && isCacheFresh(this.fetchedAt, maxAgeMs)) return;
      await this.refresh();
    },

    async refresh() {
      if (!this.userId) return;
      if (tagsRefreshInflight) return tagsRefreshInflight;

      this.loading = true;
      tagsRefreshInflight = (async () => {
        try {
          const res = await client.api.tags.$get().catch(() => null);
          if (res?.ok) {
            this.tags = await res.json();
            this.loaded = true;
            this.stale = false;
            this.fetchedAt = Date.now();
            this.persist();
          }
        } finally {
          this.loading = false;
          tagsRefreshInflight = null;
        }
      })();

      return tagsRefreshInflight;
    },

    // Mark the usage counts as possibly-out-of-date. Cheap and idempotent; the refetch is
    // deferred to the next load()/refresh (layout interval, Status mount, or force).
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
      this.persist();
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
      this.persist();
      return null;
    },

    // Recolour in place (name/pins untouched). Returns whether it stuck.
    async setColor(id: string, color: TagColor): Promise<boolean> {
      const res = await client.api.tags[':id'].$patch({ param: { id }, json: { color } });
      if (!res.ok) return false;
      const updated = await res.json();
      this.tags = this.tags.map((t) => (t.id === id ? { ...t, color: updated.color } : t));
      this.persist();
      return true;
    },

    async deleteTag(id: string): Promise<boolean> {
      const res = await client.api.tags[':id'].$delete({ param: { id } });
      if (!res.ok) return false;
      this.tags = this.tags.filter((t) => t.id !== id);
      this.persist();
      return true;
    },
  },
});
