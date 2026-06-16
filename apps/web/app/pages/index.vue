<script setup lang="ts">
import { signOut } from '~/lib/auth-client';
import { usePlayerStore } from '~/stores/player';

// Session stays the source of truth; the store is a projection of session.user.
const { data: session } = await useAuthSession();
const player = usePlayerStore();

// Re-hydrate whenever the session changes so the store never drifts from it.
// session.user.xp / .level are typed via inferAdditionalFields<Auth>().
watchEffect(() => player.hydrate(session.value?.user));

const loggingOut = ref(false);
async function onSignOut() {
  loggingOut.value = true;
  await signOut();
  // Drop the cached session so the guard sees us as logged out on /login.
  await refreshAuthSession();
  await navigateTo('/login');
}
</script>

<template>
  <section class="sq-panel">
    <p class="sq-tag">[ SYSTEM ]</p>
    <h1>{{ player.name ?? 'Hunter' }}</h1>

    <div class="sq-stats">
      <div class="sq-level">
        <span class="sq-level-label">LEVEL</span>
        <span class="sq-level-num">{{ player.level }}</span>
      </div>

      <div class="sq-xp">
        <div class="sq-xp-head">
          <span>XP</span>
          <span>{{ player.xp }} / {{ player.xpForNextLevel }}</span>
        </div>
        <div class="sq-bar">
          <div class="sq-bar-fill" :style="{ width: `${player.levelProgress * 100}%` }" />
        </div>
      </div>
    </div>

    <button type="button" :disabled="loggingOut" @click="onSignOut">
      {{ loggingOut ? 'Signing out…' : 'Sign out' }}
    </button>
  </section>
</template>

<style scoped>
.sq-panel {
  width: 100%;
  max-width: 420px;
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
  margin: 0.25rem 0 1.5rem;
  font-size: 1.8rem;
  color: #eaf2ff;
  text-shadow: 0 0 12px rgba(91, 139, 255, 0.6);
}
.sq-stats {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.sq-level {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}
.sq-level-label {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #8fa9d8;
}
.sq-level-num {
  font-size: 2.2rem;
  font-weight: 700;
  color: #5b8bff;
  text-shadow: 0 0 14px rgba(91, 139, 255, 0.7);
}
.sq-xp-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #9bb4e6;
  margin-bottom: 0.4rem;
}
.sq-bar {
  height: 10px;
  background: #060c1c;
  border: 1px solid #29407e;
  border-radius: 999px;
  overflow: hidden;
}
.sq-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2f6bff, #7aa6ff);
  box-shadow: 0 0 12px rgba(91, 139, 255, 0.8);
  transition: width 0.4s ease;
}
button {
  margin-top: 2rem;
  width: 100%;
  padding: 0.7rem;
  background: transparent;
  border: 1px solid #2a4dd0;
  border-radius: 6px;
  color: #cfe3ff;
  font-weight: 600;
  cursor: pointer;
}
button:hover:not(:disabled) {
  background: rgba(56, 120, 255, 0.15);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
