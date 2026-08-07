<script setup lang="ts">
import { signIn } from '~/lib/auth-client';

definePageMeta({ layout: 'auth' });

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref<string | null>(null);

async function onSubmit() {
  loading.value = true;
  errorMsg.value = null;

  const { error } = await signIn.email({
    email: email.value,
    password: password.value,
  });

  loading.value = false;

  if (error) {
    errorMsg.value = error.message ?? 'Invalid credentials.';
    return;
  }

  // Refresh the cached session so the guard sees us as logged in on /.
  await refreshAuthSession();
  await navigateTo('/');
}
</script>

<template>
  <section class="dl-row-in corner-cut w-full max-w-[380px] border border-dl-grid-line bg-dl-surface">
    <!-- Panel header band — mirrors the DlModal chrome: violet dot + mono-caps label. -->
    <header class="flex items-center gap-2 border-b border-dl-band-line px-5 py-3">
      <span class="h-1 w-1 shrink-0 bg-dl-violet" aria-hidden="true" />
      <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Sign in</span>
    </header>

    <div class="px-5 py-6 md:px-6">
      <h1 class="font-dl-display text-dl-title font-semibold leading-tight text-dl-ink">Welcome back</h1>
      <p class="mt-1 text-dl-body text-dl-ink-muted">Sign in to resume your quests.</p>

      <form @submit.prevent="onSubmit" class="mt-6 flex flex-col gap-4">
        <!-- Error — magenta reads on the bar only, never as coloured text (system law). -->
        <p v-if="errorMsg" role="alert" class="border-l-[3px] border-dl-magenta bg-dl-sunk px-3 py-2 text-dl-body text-dl-ink">{{ errorMsg }}</p>

        <label class="flex flex-col gap-1.5">
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Email</span>
          <input v-model="email" type="email" required autocomplete="email" class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="font-dl-mono text-dl-label uppercase tracking-wide text-dl-ink-muted">Password</span>
          <input v-model="password" type="password" required autocomplete="current-password" class="dl-focus-inset border border-dl-grid-line bg-dl-surface px-3 py-2 text-dl-body text-dl-ink outline-none placeholder:text-dl-ink-faint" />
        </label>

        <button type="submit" :disabled="loading" class="dl-focus-inset mt-1 cursor-pointer bg-dl-violet px-5 py-2.5 font-dl-mono text-dl-label font-semibold uppercase tracking-wide text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="mt-6 text-center text-dl-body text-dl-ink-muted">
        No account yet?
        <NuxtLink to="/register" class="dl-focus-inset font-medium text-dl-violet hover:text-dl-violet-hot hover:underline">Register</NuxtLink>
      </p>
    </div>
  </section>
</template>
