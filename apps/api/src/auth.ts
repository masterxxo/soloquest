import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
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
})
