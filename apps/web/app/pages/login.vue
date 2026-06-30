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
  <section class="sq-panel">
    <p class="sq-tag">[ SYSTEM ]</p>
    <h1>Welcome back, Hunter</h1>
    <p class="sq-sub">Sign in to resume your quests.</p>

    <form @submit.prevent="onSubmit">
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="email" />
      </label>
      <label>
        Password
        <input v-model="password" type="password" required autocomplete="current-password" />
      </label>

      <p v-if="errorMsg" class="sq-error">{{ errorMsg }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <p class="sq-alt">
      No account yet? <NuxtLink to="/register">Register</NuxtLink>
    </p>
  </section>
</template>

<style scoped>
.sq-panel {
  width: 100%;
  max-width: 360px;
  padding: 2rem;
  background: rgba(10, 20, 45, 0.75);
  border: 1px solid #2a4dd0;
  border-radius: 12px;
  box-shadow: 0 0 24px rgba(56, 120, 255, 0.35), inset 0 0 18px rgba(56, 120, 255, 0.12);
  backdrop-filter: blur(6px);
}
.sq-tag {
  margin: 0;
  letter-spacing: 0.3em;
  font-size: 0.7rem;
  color: #5b8bff;
}
h1 {
  margin: 0.25rem 0 0;
  font-size: 1.6rem;
  color: #eaf2ff;
  text-shadow: 0 0 12px rgba(91, 139, 255, 0.6);
}
.sq-sub {
  margin: 0.25rem 0 1.5rem;
  font-size: 0.85rem;
  color: #8fa9d8;
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #9bb4e6;
}
input {
  padding: 0.6rem 0.75rem;
  background: #060c1c;
  border: 1px solid #29407e;
  border-radius: 6px;
  color: #eaf2ff;
  font-size: 0.95rem;
  outline: none;
}
input:focus {
  border-color: #5b8bff;
  box-shadow: 0 0 0 2px rgba(91, 139, 255, 0.25);
}
button {
  margin-top: 0.5rem;
  padding: 0.7rem;
  background: linear-gradient(180deg, #2f6bff, #1d3fb8);
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 16px rgba(56, 120, 255, 0.5);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.sq-error {
  margin: 0;
  font-size: 0.8rem;
  color: #ff8080;
}
.sq-alt {
  margin: 1.25rem 0 0;
  font-size: 0.8rem;
  color: #8fa9d8;
  text-align: center;
}
.sq-alt a {
  color: #5b8bff;
}
</style>
