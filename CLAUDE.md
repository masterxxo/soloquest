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
- **Keep this file true.** If a task changes the scope, changes an architectural decision,
  or deliberately removes or freezes something — update CLAUDE.md in the same commit and
  say so in the report. The file maintains itself as a by-product of the work, not as a
  separate chore.

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
- **Tests:** Vitest. Most are pure unit tests (no DB). Logic that must exercise a real
  transaction/schema uses an **in-process pglite harness** (`apps/api/src/test/db.ts`,
  `createTestDb()`): a fresh in-memory Postgres (WASM — no Docker, no network, never the
  prod/dev DB) migrated to the current schema, one per test. Get a database from it and
  pass it into the code under test — the helpers take a `DrizzleDB` argument, so nothing
  about `db` or `grantXp` is ever mocked. See `quest-cascade.test.ts` for the pattern.
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
   `pgEnum`s, the Zod `z.enum`s, and the frontend. **Every** enum lives there — difficulty,
   quest status, recurrence type, achievement type, and anything added later. No enum tuple
   is declared inline in the Drizzle schema: `pgEnum` only ever *consumes* a tuple imported
   from `@soloquest/shared/enums`. **Reordering the values of an existing enum means an
   `ALTER TYPE` — forbidden.** Append only.
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
  Completing a parent **cascades** into its still-active direct sub-tasks: each is closed,
  granted its XP, and appended to `quest_completions` inside the *same* transaction as the
  parent (`completeQuestRow`), sharing one `completedAt`. Sub-tasks already `completed`/`failed`
  are skipped (idempotent — no double XP, no duplicate log). The `/complete` response carries
  `cascadedCompletions: number`, and `leveledUp`/player state are computed after the whole
  cascade so a level-up reached only by the summed XP isn't lost.
- A rank filter on the quest list (`useRankFilter` + `QuestFilterBar`), entirely
  client-side over the already-loaded array — it narrows the deadline grouping, it never
  reaches the API. It is **additive**: the
  chips start unlit and each lit rank *adds* its quests, so an empty selection means "no
  filter" (the whole board), never "hide everything". The selection lives in the URL
  (no param = nothing lit; `?rank=D,A` = only those), written with `router.replace`, so a
  refresh keeps it and a fresh `/` from the nav resets it.
- Recurring quests — surfaced in the UI as **"Rituals"** — with streaks and a completion
  calendar.
- `quest_completions`: an append-only event log of completions, kept independently of the
  quests themselves.
- **Chronicles** — a read-only history view of completed quests (stats + a 30-day daily-XP
  bar chart + a completion log grouped by day). Two read endpoints under the existing quests
  router: `GET /api/quests/completions/summary` (all-time totals + `byRank` + timeline) and
  `GET /api/quests/completions` (keyset-paginated log on `completedAt DESC, id DESC`). Both
  derive each calendar day from `completedAt` in the user's timezone via `getUserDate`
  (never a UTC `date_trunc`), and `summary.totalCompleted` counts the same log rows as
  `/stats`, so the two can't diverge. Recurring quests keep their own streak/heatmap and are
  deliberately not part of Chronicles.
- Achievements (streak milestones and lifetime totals), seeded idempotently.
- Per-user timezone (`user_settings`), and a nightly cron that judges yesterday in each
  user's own timezone and resets broken streaks.

---

## Deliberate negative decisions (do not undo)

- **Campaigns are gone from every layer** and stay gone — that scope belongs to the future
  project-management app. Do not reintroduce them. (They survive only in old migration
  files, which are immutable history, not a hint.)
- **"Rituals" is a UI label only** — and the boundary is exact, in both directions:
  - **`recurring` everywhere in domain, data and types.** `apps/api`, `packages/db`,
    `packages/shared`, every wire type crossing into the frontend (e.g.
    `RecurringCalendarDay`), and any frontend identifier holding those types. No identifier
    — function, type, variable, file name — says "Ritual".
  - **"Rituals" only in presentation.** The `/rituals` route and `rituals.vue`, plus
    user-visible copy: headings, tab labels, buttons, toasts. That copy is deliberate; do
    not "fix" it to say "recurring".
  - Components are already named `Recurring*`. Leave them.
- **"Chronicles" is a UI label only**, exactly like "Rituals". The `/chronicles` route,
  `chronicles.vue`, `Chronicle*` components and user-facing copy may say "Chronicles"; the
  backend, tables, endpoints and wire types stay in `quest-completions` vocabulary. There is
  no "chronicles" domain in `apps/api`, `packages/db` or `packages/shared`.
  - **Sub-tasks are a deliberate, kept feature** for breaking large quests into smaller
  steps. Do not propose removing them or collapsing the parent/sub-task hierarchy.
  - **The sub-task hierarchy is one level deep by assumption** — the list nests `subTasks`
  one level and `QuestCard` caps nesting at one. The completion cascade closes exactly that
  one level of direct children; allowing deeper nesting in the UI would mean making the
  cascade recursive first.
- **The quest list's flat grouping is top-level only, on purpose** — `index.vue` groups
  only `parentId == null` quests (`baseQuests`). The list GET *does* return sub-tasks as
  flat rows (it passes `include=subTasks`, not `parentId=null`) and the page drops them, so
  a filter that removes sub-task *rows* from that flat list is a no-op by construction — do
  not add one. Sub-tasks are still visible, but *only* nested: `QuestCard` renders each
  quest's `subTasks` indented under it. That nested rendering is the real, hideable surface,
  and the **"Hide sub-tasks"** filter (`?top=1`) targets exactly it — it toggles
  `QuestCard`'s `showSubTasks` prop, collapsing the nested block, and removes no quest from
  the list. It lives in `useRankFilter` alongside the ranks (so "is any filter on" and
  "Clear" span both dimensions) and, because it narrows no count, deliberately does **not**
  feed "Showing X of Y" — it shows its own "Sub-tasks hidden" note instead.
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
