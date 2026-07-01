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
  <section class="w-full max-w-[360px] rounded-[12px] border border-[#2a4dd0] bg-[rgba(10,20,45,0.75)] p-8 shadow-[0_0_24px_rgba(56,120,255,0.35),inset_0_0_18px_rgba(56,120,255,0.12)] backdrop-blur-[6px]">
    <p class="m-0 text-[0.7rem] tracking-[0.3em] text-blue">[ SYSTEM ]</p>
    <h1 class="m-0 mt-1 text-[1.6rem] text-[#eaf2ff] [text-shadow:0_0_12px_rgba(91,139,255,0.6)]">Welcome back, Hunter</h1>
    <p class="m-0 mb-6 mt-1 text-[0.85rem] text-[#8fa9d8]">Sign in to resume your quests.</p>

    <form @submit.prevent="onSubmit" class="flex flex-col gap-[0.9rem]">
      <label class="flex flex-col gap-[0.35rem] text-[0.8rem] text-[#9bb4e6]">
        Email
        <input v-model="email" type="email" required autocomplete="email" class="rounded-[6px] border border-[#29407e] bg-[#060c1c] px-3 py-[0.6rem] text-[0.95rem] text-[#eaf2ff] outline-none focus:border-blue focus:shadow-[0_0_0_2px_rgba(91,139,255,0.25)]" />
      </label>
      <label class="flex flex-col gap-[0.35rem] text-[0.8rem] text-[#9bb4e6]">
        Password
        <input v-model="password" type="password" required autocomplete="current-password" class="rounded-[6px] border border-[#29407e] bg-[#060c1c] px-3 py-[0.6rem] text-[0.95rem] text-[#eaf2ff] outline-none focus:border-blue focus:shadow-[0_0_0_2px_rgba(91,139,255,0.25)]" />
      </label>

      <p v-if="errorMsg" class="m-0 text-[0.8rem] text-danger-bright">{{ errorMsg }}</p>

      <button type="submit" :disabled="loading" class="mt-2 cursor-pointer rounded-[6px] border-0 bg-gradient-to-b from-[#2f6bff] to-[#1d3fb8] p-[0.7rem] font-semibold text-white shadow-[0_0_16px_rgba(56,120,255,0.5)] disabled:cursor-not-allowed disabled:opacity-60">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <p class="m-0 mt-5 text-center text-[0.8rem] text-[#8fa9d8]">
      No account yet? <NuxtLink to="/register" class="text-blue">Register</NuxtLink>
    </p>
  </section>
</template>
