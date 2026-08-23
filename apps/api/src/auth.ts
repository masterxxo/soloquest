import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from '@better-auth/api-key';
import { db } from '@soloquest/db/client';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  // Proxied auth calls keep the web Origin header, so trust it (else "invalid origin").
  trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:3000'],
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      xp: { type: 'number', defaultValue: 0, input: false, required: true },
      level: { type: 'number', defaultValue: 1, input: false, required: true },
    },
  },
  plugins: [
    // Per-user keys for remote MCP (and any machine client). A valid key mocks a session
    // so existing requireAuth routes keep working unchanged. The key is as powerful as a
    // cookie session for that user — treat it like a password.
    apiKey({
      enableSessionForAPIKeys: true,
      defaultPrefix: 'sq_',
      requireName: true,
      // MCP hosts send Authorization: Bearer; Better Auth defaults to x-api-key.
      customAPIKeyGetter: (ctx) => {
        const request = ctx.request;
        if (!request) return null;
        const authorization = request.headers.get('authorization');
        if (authorization?.startsWith('Bearer ')) {
          const token = authorization.slice('Bearer '.length).trim();
          return token.length > 0 ? token : null;
        }
        return request.headers.get('x-api-key');
      },
      // Default plugin limit is 10/day — too low for an agent tool loop.
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60 * 60,
        maxRequests: 1000,
      },
    }),
  ],
});
