import { createAuthClient } from 'better-auth/vue';
import { inferAdditionalFields } from 'better-auth/client/plugins';
// type-only: keeps server code out of the client bundle, but types xp/level on session.user.
import type { Auth } from '@soloquest/api';

// No baseURL: same-origin in the browser, /api/auth/* proxied to the backend (no CORS).
// SSR-side fetching is handled in useAuthSession.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});

// NOTE: authClient.useSession is intentionally NOT re-exported — it subscribes to a
// nanostore via an effect scope and OOMs the SSR render worker (see useAuthSession).
export const { signIn, signUp, signOut } = authClient;
