# CLAUDE.md

## Project: SoloQuest

A Solo Leveling–themed RPG todo app. The user completes real-life tasks ("quests")
to earn XP; XP levels up the player. This is a **portfolio project** demonstrating a
modern fullstack TypeScript stack. Two things matter equally: it ships and looks good,
**and** every decision must be explainable in an interview.

---

## ⚠️ Golden rule: stay in scope

This is an MVP built in versioned slices. Build **only** what is in the current
version's scope. Do **not** add features from later versions, even when they look like
a natural next step. If a request is ambiguous or seems out of scope, **ask before
implementing**.

### v0.1 — current scope
- Email + password auth (Better Auth)
- Quest CRUD: title, description, difficulty (E–S), deadline
- Completing a quest grants XP (server-side only)
- Player level + XP progress bar
- Solo Leveling UI vibe: dark theme, blue glow, "System" aesthetic

### Explicitly OUT of scope — do NOT build yet
- Stats (STR / INT / AGI) → v0.2
- Daily quests / streaks → v0.2
- Ranks, titles, achievements → v0.3
- PixiJS, animations, kingdom-building, any game-engine features → not planned

---

## Tech stack
- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Nuxt 4 (`app/` directory), Pinia for player state
- **Backend:** Hono on Node (`@hono/node-server`)
- **API contract:** Hono RPC — end-to-end types, no codegen, no tRPC, no GraphQL
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better Auth (Drizzle adapter)
- **Validation:** Zod (in the shared package)

## Structure
```
apps/web        Nuxt frontend (package name: web)
apps/api        Hono backend (package name: api)
packages/db     Drizzle schema + migrations — @soloquest/db
packages/shared Zod schemas, leveling logic, shared types — @soloquest/shared
```

---

## Architecture rules (non-negotiable)

1. **Server-authoritative XP/level.** Clients NEVER send `xp` or `level`. They are
   `input: false` additionalFields on the Better Auth user. XP is granted only by the
   backend in `POST /api/quests/:id/complete`.
2. **Better Auth owns the auth tables** (`user`, `session`, `account`, `verification`).
   Do NOT hand-write them or reintroduce a custom `users` table. Never store password
   hashes manually — Better Auth handles credentials in the `account` table.
3. **`packages/db` stays dumb.** Table definitions only; depends on `drizzle-orm`, not
   on `better-auth`. Business logic lives in `apps/api`; pure shared logic (leveling
   math, zod schemas) lives in `packages/shared`.
4. **Types flow via Hono RPC.** Export `AppType` from the api, consume with
   `hc<AppType>` in web. No manually written API types.
5. **User ids are `text`** (Better Auth default). Every FK referencing a user uses
   `text`, never `uuid`.
6. **Migrations are file-based.** Use `drizzle-kit generate` → `migrate`. Never
   `drizzle-kit push` outside throwaway prototyping. Squashing migrations is allowed
   ONLY while there is no real data.

---

## Leveling logic
Lives in `packages/shared/src/leveling.ts`, used by both api (granting XP) and web
(progress display). Single source of truth — do not duplicate it.

- XP rewards by difficulty: `E=10, D=25, C=50, B=100, A=250, S=500`
- Level curve: `xpForLevel(n) = floor(100 * n^1.5)`

---

## Commands
```bash
pnpm dev                                   # run all apps (turbo)
pnpm --filter web dev                      # frontend only
pnpm --filter api dev                      # backend only

docker compose up -d                       # start Postgres
pnpm --filter @soloquest/db db:generate    # generate a migration from schema
pnpm --filter @soloquest/db db:migrate     # apply migrations

# regenerate Better Auth schema after changing auth config (run from apps/api):
pnpm dlx @better-auth/cli@latest generate \
  --config ./src/auth.ts \
  --output ../../packages/db/src/schema/auth.ts -y
```

---

## Conventions
- TypeScript everywhere, ESM, strict mode.
- Single root `.env`, loaded via `--env-file` (api dev/start) and a `dotenv` path in
  `drizzle.config.ts`.
- All routes under the `/api` basePath.
- Zod validation on every mutating endpoint via `@hono/zod-validator`.

## When adding code
- Confirm the change is in the **current scope** before building it.
- **Ask before adding a new dependency.**
- Do not reintroduce removed patterns: custom `users` table, manual password hashing,
  `uuid` user ids.
- Keep `packages/db` free of business logic and of `better-auth`.