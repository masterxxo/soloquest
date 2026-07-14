# CLAUDE.md

## Project: SoloQuest

A Solo Leveling–themed RPG task manager. Completing a quest grants XP; XP raises the
player's level. It is both a portfolio piece and something the author actually uses every
day, so it has to be defensible in an interview *and* pleasant to live with.

Production: <https://soloquest.rogson.dev>

It is the first of four planned apps in one ecosystem (task manager → project manager →
diet → training). That matters for scope: when a feature smells like it belongs to one of
the other three, it does not belong here.

---

## Language policy (read this first)

**Everything committed to this repo is in English** — code, comments, identifiers, file
paths, package names, commit messages, UI copy, documentation. This holds regardless of
the language a request is written in.

The single exception is localization files (`locales/`, `i18n/`, `lang/`). i18n is not in
the project yet; when it lands those files will legitimately hold other languages, which
is why they are already excluded from linting.

This is enforced, not merely requested: a custom ESLint rule (`soloquest/no-polish-characters`,
defined in `packages/eslint-config`) fails the build on Polish diacritics, and CI gates the
deploy on `pnpm lint`.

---

## Agent execution rules

The dev environment is already running and the user is watching it. Do not reproduce
verification that is happening outside the agent.

- **Never start the dev server.** It is always already running with HMR — your edits are
  picked up live. No `pnpm dev`, no `nuxi dev`, no variant, not even "just to check".
- **Never apply migrations and never touch the production database.** Generating a
  migration file is a code change; applying it is an operation the user performs.
- **Do not auto-run linters, type-checks, builds, or tests** after editing. If you truly
  need a check before you can proceed correctly, ask first.
- **No `eslint-disable` in application code.** If a rule fires, either the code is wrong or
  the rule is wrong; both are worth a conversation, neither is worth a suppression comment.
- **No drive-by reformatting** or cosmetic edits outside the scope you were given.
- **Report, don't fix.** Something suspicious but out of scope: say so, leave it alone.
- **Stop when the task is done.** Summarize what changed and what to verify, then end the
  turn. Do not continue into adjacent work "while you're in there".

Rationale: the feedback loop (running dev server, editor, manual review) lives entirely
outside the agent. Re-running it inside the agent is pure overhead.

---

## Stack

- **Monorepo:** Turborepo + pnpm workspaces. Node 24 (`engines.node`, `mise.toml`,
  the Dockerfiles, and CI all agree — keep it that way).
- **Frontend:** Nuxt 4 (`app/` directory), Pinia, Tailwind.
- **Backend:** Hono on Node (`@hono/node-server`), run directly from TypeScript via `tsx`
  (no build step for the API).
- **API contract:** Hono RPC — `AppType` exported from the api, consumed with `hc<AppType>`.
  End-to-end types, no codegen, no tRPC, no GraphQL.
- **Database:** PostgreSQL + Drizzle ORM.
- **Auth:** Better Auth (Drizzle adapter).
- **Validation:** Zod, schemas in the shared package.
- **Tests:** Vitest (`apps/api`, `packages/shared` — pure unit tests, no DB).
- **Lint:** ESLint 9, flat config, shared via `@soloquest/eslint-config`.
- **Deploy:** Hetzner + Coolify; GitHub Actions runs lint ∥ typecheck → test, then pings
  Coolify's deploy webhooks on `master`.

### Structure

```
apps/web              Nuxt frontend            @soloquest/web
apps/api              Hono backend             @soloquest/api
packages/db           Drizzle schema + migrations   @soloquest/db
packages/shared       Zod schemas, leveling, enums  @soloquest/shared
packages/eslint-config Shared flat config + the language rule
```

---

## Architecture decisions (in force)

1. **Server-authoritative XP and level.** The client never sends `xp` or `level`; they are
   `input: false` additional fields on the Better Auth user. XP is granted only by the
   backend, on quest and ritual completion, from the server-side reward table.
2. **Leveling logic lives in `@soloquest/shared`** (`leveling.ts`) and is the single source
   of truth for both the API (granting) and the web app (progress display). Never duplicate
   it. Note `xpForLevel(n)` is the cost *of* level n, not a cumulative threshold.
3. **One source of truth for enums.** `packages/shared/src/enums.ts` feeds the Drizzle
   `pgEnum`s, the Zod `z.enum`s, and the frontend. **Reordering the values of an existing
   enum means an `ALTER TYPE` — forbidden.** Append only.
4. **Migrations are file-based and reviewed.** `drizzle-kit generate` → read the SQL →
   apply by hand on production → verify with a query against the database. Never
   `drizzle-kit push`. Never auto-apply.
5. **Better Auth owns the auth tables** (`user`, `session`, `account`, `verification`). Do
   not hand-write them, do not add a second users table, never hash passwords manually.
   `auth.ts` — not the Drizzle schema — is the source for auth columns: after editing it,
   re-run the Better Auth CLI, *then* `drizzle-kit` (see Commands).
6. **User ids are `text`** (Better Auth's default). Every FK referencing a user is `text`,
   never `uuid`.
7. **Same-origin, no CORS.** The API mounts everything under the `/api` basePath and no CORS
   middleware exists. In dev, Nuxt's `nitro.devProxy` forwards `/api`; in production the
   reverse proxy (Coolify/Traefik) puts web and api on one origin. Data fetching is
   client-side; the one deliberate exception is the SSR session fetch in `useAuthSession`,
   which uses an absolute base and forwards the cookie header.
8. **Pinia is the source of player state in the UI** — the stores project server-owned
   values, they never compute XP or level themselves.
9. **Calendar dates are `YYYY-MM-DD` strings in the user's timezone**, derived through one
   helper (`getUserDate` / `toDateString` in the API, `localDateString` in the web app).
   Do not mix frames of reference — this rule governs rituals, streaks and the completion
   calendar. (One-off quest `deadline` / `completedAt` are genuine timestamps; that is a
   different thing and stays that way.)
10. **Ownership is validated centrally** — `findOwnedQuest` / `findOwnedRecurringQuest`.
    Never re-implement the "is this row mine" check inline in a route.
11. **XP granting is atomic** — `grantXp` does a SQL-level increment inside a transaction.
    Never read-modify-write XP in application code.
12. **Errors have one shape:** `{ error: string }`. Import `zValidator` from `lib/validate`
    (the wrapper that flattens Zod errors into that shape), never from `@hono/zod-validator`
    directly.

---

## What is in the project

All of the following exist, are used, and are meant to stay:

- Email + password auth; the Better Auth built-in **`name`** is the player's display name.
  There is no `username` field — do not add one.
- Quest CRUD with difficulty (E–S), deadlines, and sub-tasks (self-referencing `parentId`).
- Recurring quests — surfaced in the UI as **"Rituals"** — with streaks and a completion
  calendar.
- `quest_completions`: an append-only event log of completions, kept independently of the
  quests themselves.
- Achievements (streak milestones and lifetime totals), seeded idempotently.
- Per-user timezone (`user_settings`), and a nightly cron that judges yesterday in each
  user's own timezone and resets broken streaks.

---

## Deliberate negative decisions (do not undo)

- **Campaigns are gone from every layer** and stay gone — that scope belongs to the future
  project-management app. Do not reintroduce them. (They survive only in old migration
  files, which are immutable history, not a hint.)
- **"Rituals" is a UI label only.** The backend, tables, endpoints and wire types remain
  `recurring`. Do not rename them.
- **No squashing of Drizzle migrations.** The history stands.
- **Rank auto-derivation from sub-tasks is frozen** on purpose; the rank check only ever
  produces a non-blocking warning.
- **The stylistic ESLint rules (`vue/html-self-closing`, `vue/attributes-order`) are off on
  purpose.** This repo has no Prettier and no style lint by design. Do not turn them on, do
  not reformat templates.

---

## Commands

```bash
# Do NOT run the dev server — it is already running (see Agent execution rules).

docker compose up -d                       # Postgres, local only
pnpm lint / pnpm typecheck / pnpm test     # what CI runs

pnpm --filter @soloquest/db db:generate    # generate a migration from the schema
pnpm --filter @soloquest/db db:migrate     # apply it — the USER runs this, not the agent

# After changing apps/api/src/auth.ts, regenerate the auth schema (run from apps/api),
# THEN db:generate:
pnpm dlx @better-auth/cli@latest generate --config ./src/auth.ts \
  --output ../../packages/db/src/schema/auth.ts -y
```

---

## When adding code

- **Ask before adding a dependency.**
- Check the change belongs to *this* app and not to one of the three future ones.
- `packages/db` stays dumb: table definitions only. No business logic, no `better-auth`
  import. Business logic lives in `apps/api`; pure shared logic (leveling, enums, Zod
  schemas) lives in `packages/shared`.
- Zod validation on every mutating endpoint.
- Do not reintroduce removed patterns: a custom users table, manual password hashing,
  `uuid` user ids, a `username` field, or campaigns.
