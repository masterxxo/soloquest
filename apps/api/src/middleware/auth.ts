import type { MiddlewareHandler } from 'hono';
import { auth } from '../auth';

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;
export type SessionUser = NonNullable<SessionResult>['user'];
export type SessionInfo = NonNullable<SessionResult>['session'];

export type Variables = {
  user: SessionUser | null;
  session: SessionInfo | null;
};

// Populate the session into context for every request (null when unauthenticated).
export const sessionMiddleware: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('user', result?.user ?? null);
  c.set('session', result?.session ?? null);
  await next();
};

// Reject anyone without a session. Mount on routers that require auth.
export const requireAuth: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  if (!c.get('user')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};
