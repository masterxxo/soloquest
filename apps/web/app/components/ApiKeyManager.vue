<script setup lang="ts">
import { authClient } from '~/lib/auth-client';

type ApiKeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  enabled: boolean | null;
  createdAt: Date | string;
  expiresAt: Date | string | null;
};

const keys = ref<ApiKeyRow[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const newName = ref('');
const creating = ref(false);
const createError = ref<string | null>(null);
/** Plaintext key shown once after create — never stored again. */
const revealedKey = ref<string | null>(null);
const copied = ref(false);

const revokingId = ref<string | null>(null);
const revokeError = ref<string | null>(null);

const mcpUrl = computed(() => {
  if (import.meta.client && typeof window !== 'undefined') {
    return `${window.location.origin}/api/mcp`;
  }
  return 'https://soloquest.rogson.dev/api/mcp';
});

function formatWhen(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

async function loadKeys() {
  loading.value = true;
  loadError.value = null;
  try {
    const { data, error } = await authClient.apiKey.list();
    if (error) {
      loadError.value = error.message ?? 'Failed to load API keys.';
      keys.value = [];
      return;
    }
    const list = (data as { apiKeys?: ApiKeyRow[] } | ApiKeyRow[] | null);
    if (Array.isArray(list)) {
      keys.value = list;
    } else if (list && Array.isArray(list.apiKeys)) {
      keys.value = list.apiKeys;
    } else {
      keys.value = [];
    }
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load API keys.';
    keys.value = [];
  } finally {
    loading.value = false;
  }
}

async function createKey() {
  const name = newName.value.trim();
  if (!name) {
    createError.value = 'Name is required.';
    return;
  }
  creating.value = true;
  createError.value = null;
  copied.value = false;
  try {
    const { data, error } = await authClient.apiKey.create({ name });
    if (error) {
      createError.value = error.message ?? 'Failed to create API key.';
      return;
    }
    const created = data as (ApiKeyRow & { key?: string }) | null;
    if (!created?.key) {
      createError.value = 'Key was created but the secret was not returned. Revoke it and try again.';
      await loadKeys();
      return;
    }
    revealedKey.value = created.key;
    newName.value = '';
    await loadKeys();
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to create API key.';
  } finally {
    creating.value = false;
  }
}

async function copyRevealed() {
  if (!revealedKey.value || !import.meta.client) return;
  try {
    await navigator.clipboard.writeText(revealedKey.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

function dismissReveal() {
  revealedKey.value = null;
  copied.value = false;
}

async function revokeKey(id: string) {
  revokingId.value = id;
  revokeError.value = null;
  try {
    const { error } = await authClient.apiKey.delete({ keyId: id });
    if (error) {
      revokeError.value = error.message ?? 'Failed to revoke API key.';
      return;
    }
    if (revealedKey.value) dismissReveal();
    await loadKeys();
  } catch (err) {
    revokeError.value = err instanceof Error ? err.message : 'Failed to revoke API key.';
  } finally {
    revokingId.value = null;
  }
}

onMounted(() => {
  loadKeys();
});
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-2 border-b border-dl-band-line pb-1">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">API keys</span>
      <span class="font-dl-mono text-dl-label text-dl-ink-faint">{{ keys.length }}</span>
    </div>

    <p class="m-0 text-dl-body text-dl-ink-muted">
      Machine access for remote MCP. A key is as powerful as being signed in — create one, paste it into your MCP host, revoke when done. The secret is shown once.
    </p>

    <div class="border border-dl-hairline bg-dl-surface px-3 py-2">
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">MCP endpoint</span>
      <p class="m-0 mt-1 break-all font-dl-mono text-dl-meta text-dl-ink">{{ mcpUrl }}</p>
      <p class="m-0 mt-1 font-dl-mono text-[0.6rem] uppercase tracking-wide text-dl-ink-faint">
        Authorization: Bearer &lt;key&gt;
      </p>
    </div>

    <div
      v-if="revealedKey"
      class="flex flex-col gap-2 border border-dl-gold bg-dl-gold/10 px-3 py-2"
    >
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink">Copy now — this is the only time the full key is shown</span>
      <code class="break-all font-dl-mono text-dl-meta text-dl-ink">{{ revealedKey }}</code>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
          @click="copyRevealed"
        >{{ copied ? 'Copied' : 'Copy' }}</button>
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink"
          @click="dismissReveal"
        >Dismiss</button>
      </div>
    </div>

    <form class="flex flex-col gap-2 sm:flex-row sm:items-end" @submit.prevent="createKey">
      <label class="flex min-w-0 flex-1 flex-col gap-1.5">
        <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">New key name</span>
        <input
          v-model="newName"
          type="text"
          maxlength="32"
          placeholder="e.g. Cursor"
          class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none"
          :disabled="creating"
        />
      </label>
      <button
        type="submit"
        class="dl-focus-inset min-h-dl-touch cursor-pointer border border-dl-grid-line bg-dl-surface px-4 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:bg-dl-sunk hover:text-dl-ink disabled:opacity-60"
        :disabled="creating"
      >{{ creating ? 'Creating…' : 'Create key' }}</button>
    </form>
    <p v-if="createError" class="m-0 text-dl-meta text-dl-magenta">{{ createError }}</p>

    <p v-if="loading" class="m-0 text-dl-body text-dl-ink-muted">Loading keys…</p>
    <p v-else-if="loadError" class="m-0 text-dl-meta text-dl-magenta">{{ loadError }}</p>
    <p v-else-if="!keys.length" class="m-0 text-dl-body text-dl-ink-muted">No API keys yet.</p>

    <ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
      <li
        v-for="key in keys"
        :key="key.id"
        class="flex flex-wrap items-center gap-3 border border-dl-hairline bg-dl-surface px-3 py-2"
      >
        <div class="min-w-0 flex-1">
          <div class="truncate text-dl-body text-dl-ink">{{ key.name || 'Unnamed' }}</div>
          <div class="font-dl-mono text-dl-label text-dl-ink-faint">
            {{ key.start || (key.prefix ? `${key.prefix}…` : 'sq_…') }}
            · created {{ formatWhen(key.createdAt) }}
            <template v-if="key.enabled === false"> · disabled</template>
          </div>
        </div>
        <button
          type="button"
          class="dl-focus-inset cursor-pointer border border-dl-grid-line bg-dl-surface px-3 py-1 font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted hover:border-dl-magenta hover:text-dl-magenta disabled:opacity-60"
          :disabled="revokingId === key.id"
          @click="revokeKey(key.id)"
        >{{ revokingId === key.id ? 'Revoking…' : 'Revoke' }}</button>
      </li>
    </ul>
    <p v-if="revokeError" class="m-0 text-dl-meta text-dl-magenta">{{ revokeError }}</p>
  </section>
</template>
