import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@soloquest/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      username: { type: 'string', required: true },
      xp: { type: 'number', defaultValue: 0, input: false },
      level: { type: 'number', defaultValue: 1, input: false },
    },
  },
})
