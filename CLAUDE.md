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
13. **A ritual's streak is recalculated, never incremented.** Every completion recomputes
    `current` / `longest` / `total` from the *full* completion set via `recalculateStreak`,
    using the **same `wasRequiredOn` predicate** as the cron (`selectStreaksToReset`) and the
    heatmap (`buildRecurringCalendar`) — one due-day rule for all three, so they cannot drift.
    `current` = the run of consecutive *required* days each holding a completion, ending at the
    most recent required day; **today, if required but not yet done, is "in progress"** — it
    neither extends nor breaks the streak (mirrors the cron judging only closed days). `longest`
    is floored at the stored value so a recompute can never lower a past record. Incremental
    streak updates were removed because they cannot rejoin a gap filled in the middle of a run.
14. **Motion has one gate and one degrade rule** (redesign step 4 — "Daylight" motion layer).
    Every reward animation reads `useReducedMotion` (`reduced` = OS `prefers-reduced-motion`
    **OR** the "Reduce reward effects" toggle), never a media query directly. The app toggle's
    state, its localStorage persistence and the `<html class="dl-reduce-motion">` stamp all live
    in that one composable (initialised post-hydration by the `.client` plugin); the Status
    checkbox merely binds to it. When `reduced`, an animation degrades to its **instant final
    state** (the settled colour/shape/type), never a faster tween — enforced globally by the
    `tokens.css` guard zeroing every duration *and* delay under either switch. Reusable motion
    is defined once and composed, not re-declared per component: the `ease-dl`/`duration-dl-*`
    Tailwind tokens plus the `dl-*` classes in `tokens.css` (`dl-row-in` mount stagger,
    `dl-check-*`, `dl-strike`, `dl-roll-*`, `dl-xp-tip`, `dl-row-exit*`/`dl-row-placeholder`).
    The **complete-quest choreography is ~1.95s** (flash → settle+checkmark → ~500ms hold →
    slide → placeholder collapse) — timings are **runtime-verified, not from the board** (the
    board's 280ms was too short to read); do not "restore" them. Its row EXIT is **imperative**
    (QuestRow measures the row, drops a same-size placeholder to hold the slot, pins the row
    absolute and slides it off, then the page drops it from the store at slide-end and collapses
    the placeholder) — deliberately **not** a `<TransitionGroup>` leave (FLIP was unreliable with
    clip-path + variable heights). Because TODAY is derived from the active list, it decrements
    when the row is dropped at slide-end (not at slide-start) — keeping the real row means no
    store change to TODAY logic. A parent WITH sub-tasks reuses the *same* exit unchanged (the
    QuestRow root already wraps its sub-tasks, so the whole group lifts as one block); before it,
    a **downward checkmark wave** runs — the parent gesture at 0ms, each active sub-task +190ms
    (`WAVE_STEP_MS`, runtime-verified, not the board's 70ms) — driven purely in the frontend by a
    `cascadePlay`/`cascadeDelay` prop the parent passes down (the children play the identical
    checkbox gesture with no request of their own; the backend cascade is untouched). The XP
    counter still rolls **once** for the summed total (`granted` applies the post-cascade
    `result.player`), and the exit start is pushed out so it still lands ~500ms after the last
    child settles. The **ritual (recurring) complete is the same checkbox gesture, a different
    reaction** (step 4b, second beat): a ritual is repeatable, so on completion it **STAYS on its
    card** — no slide-out, no placeholder; the **streak reacts** instead. `RecurringQuestCard`
    reuses the quest-row choreography by composing the SAME `dl-check-*` tokens (flash lime →
    settle violet → draw), never a re-declared gesture, then runs two ritual-only beats: the TODAY
    pip in the `last7` strip fills pending→done (~200ms — a HeatCell background/border colour
    transition, the ONE place a HeatCell ever changes state at runtime; the heatmap's cells are
    static so it never animates there), and the CURRENT STREAK numeral ticks up by one with a short
    violet bump (`dl-streak-bump`, ~420ms). All three are **optimistic and frontend-owned** — the
    numeral freezes at its pre-click value and increments exactly at the bump so it can't drift from
    request timing; a failed/handled-error request reverts checkbox+pip+streak (error toast), a 409
    reconciles to the server's "done today". Because a ritual's done state PERSISTS, its resting
    check uses **`dl-check-settled`** (drawn mark, no settle keyframe) so it never replays the lime
    flash on reload. The flat `RECURRING_XP_REWARD` is NOT surfaced on the card (only the streak is);
    the top telemetry XP bar still rolls via the player store as for a quest. **Backfill** (a
    due-but-missed past day, from the detail heatmap) keeps reward parity but NOT presentation — it
    fills the PAST pip and recomputes the streak with no today-celebration and no bump (design K3,
    "reward parity, presentation asymmetry"), and a milestone it crosses is announced through the
    NEUTRAL notice channel (`showInfo` — one INFO per backfill, mentioning the restored streak),
    never the gold achievement toast. That split is by **path** (`onBackfill` vs the live
    `onComplete`, in `useRecurringQuestActions`), NOT by any property of the achievement — the
    live-complete path keeps its gold toast. Under `reduced`, all three beats degrade to their
    instant final state. **Reward moments** (level up = 4c-1; rank up = 4c-2) are a reusable
    **`RewardPanel`** overlay — NOT a toast — rendered at the app root over the still-live list
    (`pointer-events-none` overlay, `pointer-events-auto` panel; an outside `pointerdown` closes
    it without consuming the event, Escape closes via the modal stack, and it self-hides after
    `hold`). Its `brackets` (L-layers per corner), `hold`, optional rank `ladder`, `inverted`
    (S-rank dark scene) and `valueSize` are props: level up = 1 bracket / 3s; rank up = 2 / 4s;
    **S rank = 3 / 5s + full-screen ink `inverted`** — the ONLY inverted moment in the design.
    Two effects are **safety-gated** (removed, not slowed, under `reduced` — flash-adjacent, not
    polish): the chromatic-split **glitch** (the split *layer* is dropped; a static fringe would be
    worse) and the S-rank **inversion flip** (present in its final dark state, no animated flip).
    Level up fires via `feedback.showLevelUp(...)` (a frozen `{level, xpGain, xpForNext}` snapshot;
    `player.lastXpGain` is a display-only projection for "+X XP"); the grimoire `LevelUpToast` is
    gone. **Rank up is built but does NOT fire for real** — `detectRankPromotion(old,new)` in
    `lib/ranks.ts` is a deliberate stub (`// TODO: RANK THRESHOLDS NOT DEFINED`) that always returns
    null because the rank-band thresholds are not domain-confirmed (like the layout's "rankFromLevel
    — thresholds not finalized"). Nothing in the completion flow calls it; the panel is reached only
    by the dev-only `window.rankUp(rank, from)` trigger (`plugins/rank-up-debug.client.ts`). Wiring
    it in waits on the thresholds — treat it as a NEEDS-DOMAIN item, not dead code to "activate".
    **The lesser feedback — toasts — is the Daylight `ToastStack`** (4c-3), one container at the app
    root (bottom-right on desktop, above the mobile nav — `safe-area-inset-bottom` — on mobile). The
    feedback store owns the list, each toast's `hold` and its own auto-dismiss timer, and a 120ms
    entrance stagger for a batch that lands together. **Three types, none with an action button, each
    auto-dismissing with a bottom progress bar in its own colour:** `achievement` (ink + gold; a
    cut badge holding the milestone **threshold** — streak days or lifetime completions — and
    **never an XP figure**, since `xpBonus` is a deliberately open decision; 5s), `notice` (paper +
    3px violet bar; neutral system facts, e.g. a 409 "already done today"; 4s) and `error` (paper +
    3px magenta bar; a failed request — the optimistic update already rolled back, so no retry
    button; 4s). Store API: `showAchievements` (one toast per unlock, so several at once stack),
    `showInfo` → notice, `showError` → error, and `showWarnings` (the rank advisory) → notice —
    **there is no amber "warning" type**; the neutral channel carries advisories. Motion is gated on
    `useReducedMotion` like the RewardPanel: enter (slide from right + fade) / leave / move collapse
    to instant under `reduced`, and the progress bar stands full (the JS dismiss timer still fires);
    `aria-live` is polite for achievement/notice, assertive for error. The grimoire `LevelUpToast`,
    `NoticeToast` and `AchievementToast` are all gone; `SmokeCanvas` survives only in the grimoire
    `auth` layout and is deliberately kept.
15. **Per-user list cache is SWR in Pinia + localStorage.** Quests, rituals and tags live in
    Pinia (still the UI source of truth for those lists) and are snapshotted to
    `localStorage` keyed by user id (`lib/list-cache.ts`). A hard refresh hydrates from the
    snapshot so the board can paint before the network returns, then **always** revalidates.
    While the session stays open, `useListCacheSync` (default layout) soft-refreshes on a
    **5-minute TTL**, when the tab becomes visible again (2-minute max-age), and never clears
    painted lists before the response lands. Soft refresh is skipped while a complete is
    in flight. Midnight still invalidates via `loadedDate` (day-sensitive flags). Sign-out
    clears the snapshot and resets the stores. Chronicles / stats / heatmaps stay
    fetch-on-page — not part of this cache. Empty states must not flash during the first
    fetch (`isInitialLoading`); "No quests yet" only after a settled empty load.

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
- **"DONE TODAY"** — a suppressed strip at the bottom of the Quests list showing the day's
  completed **top-level** quests, in the user's timezone. The list GET takes
  `includeDoneToday=true` and, in the *same* round-trip, appends those quests (status
  `completed`, tags + sub-tasks) to the array; the quests store splits the response by status
  into `activeQuests` / `doneTodayQuests`. No migration — the quest entity survives completion,
  so this is a read filter on `completedAt` (a coarse 2-day instant bound, then the exact local
  day per row via `getUserDate`). Backend top-level only (`parentId IS NULL`); a sub-task
  completed on its own stays nested under its still-active parent. On a *live* complete the
  store snapshots the full live entity into `doneTodayQuests` before dropping it, so the strip
  needs no refetch and the read-only preview has full data. Rows render via `DoneQuestRow`
  (static settled `dl-check-settled` checkbox, struck/dimmed title, faded tags/priority/rank);
  the row leaves the active list with the **unchanged 4a slide-out** and then *re-appears* in
  the strip (a fresh `dl-row-in` mount — deliberately decoupled, no FLIP across the board). The
  title opens a **read-only** `QuestDetail` (`readonly` prop: no Complete/Edit/Delete, no
  per-sub-task Edit; a "Completed <date>" header signal) in the same `DlModal` chrome (bottom
  sheet on mobile). The strip empties naturally tomorrow (a post-midnight load no longer matches
  today). **There is no un-complete / undo** — see the negative decisions.
- A rank filter on the quest list (`useQuestFilters` + `QuestFilterBar`), entirely
  client-side over the already-loaded array — it narrows the deadline grouping, it never
  reaches the API. It is **additive**: the
  chips start unlit and each lit rank *adds* its quests, so an empty selection means "no
  filter" (the whole board), never "hide everything". The selection lives in the URL
  (no param = nothing lit; `?rank=D,A` = only those), written with `router.replace`, so a
  refresh keeps it and a fresh `/` from the nav resets it. (`useQuestFilters` — renamed from
  `useRankFilter` once it grew past ranks — owns every quest-list filter dimension: rank,
  priority, tags and "Hide sub-tasks".)
- **Quest priority** — `low` / `normal` / `high` (default `normal`), expressing importance
  independent of the deadline. Canonical tuple `QUEST_PRIORITY` in `@soloquest/shared/enums`
  (⚠️ ascending, append-only like every enum) → `pgEnum` (`quest_priority`) → `z.enum` →
  front, exactly the `difficulty` pattern. Column `priority` on `quests` is **NOT NULL
  DEFAULT `'normal'`**. It is a **card marker + filter dimension only — it never sorts the
  list** (deadline grouping stays the sole ordering). The marker is a chevron (`priority.ts`:
  `▲` gold for high, `▼` dimmed for low; **`normal` renders nothing**) beside the title in
  `QuestCard`, shown for all three in `QuestDetail`; `QuestForm` sets it with a segmented
  control; the filter is glyph chips in `QuestFilterBar` (`?priority=` in the URL, additive
  OR, AND-ed with the other dimensions). The create Zod field is `.optional()` **without** a
  Zod default (the DB column supplies `normal`) — a `.default()` would leak through
  `updateQuestSchema.partial()` and make an unrelated PATCH reset priority.
- Recurring quests — surfaced in the UI as **"Rituals"** — with streaks and a completion
  calendar. A **due-but-missed day can be backfilled** (completed after the fact) up to
  `MAX_BACKFILL_DAYS` (7) days back, in the user's timezone: the heatmap's missed cells in
  that window are clickable (keyboard-reachable), each POSTing its own date to the *same*
  `/complete` endpoint. "Complete today" and "backfill a past day" are **one path**
  (`completeRecurringQuestForDate`): one date arg, one atomic transaction, one flat
  `RECURRING_XP_REWARD`. The endpoint rejects (in the user's timezone) a day that is not due
  (`wasRequiredOn`), in the future, before the ritual existed, or older than the window; an
  already-completed day reuses the existing **409** (the `UNIQUE(quest, date)` constraint
  arbitrates, so no double XP). The streak is **recalculated from the full completion set**
  after every completion (see decision 13) — that is what lets a filled gap rejoin a run.
- `quest_completions`: an append-only event log of completions, kept independently of the
  quests themselves.
- **Chronicles** — a read-only history view of completed quests (stats + a 30-day daily-XP
  bar chart + a completion log grouped by day). Two read endpoints under the existing quests
  router: `GET /api/quests/completions/summary` (all-time totals + `byRank` + timeline) and
  `GET /api/quests/completions` (keyset-paginated log on `completedAt DESC, id DESC`). Both
  derive each calendar day from `completedAt` in the user's timezone via `getUserDate`
  (never a UTC `date_trunc`), and `summary.totalCompleted` counts the same log rows as
  `/stats`, so the two can't diverge. Recurring quests keep their own streak/heatmap and are
  deliberately not part of Chronicles. Each log row carries `questId` (**nullable** — `SET NULL`
  when the quest is deleted, so a completion outlives its quest) and is **clickable → the same
  read-only preview modal as DONE TODAY**. The preview is **fetch-on-click, never eager** (the
  log is keyset-paginated and can run long): `questId` null → straight to a **degraded** modal
  built from the snapshot (title/rank/xp/completedAt + an honest "this quest has been deleted"
  note, no description/tags/priority/sub-tasks); `questId` present → `GET /api/quests/:id`, on
  200 the **full** live entity, on 404 the same degraded fallback. So no row is a dead click.
  The snapshot is deliberately NOT extended (still no tags/priority) — the degraded view is the
  answer to that debt, not a reason to widen `quest_completions`.
- **`GET /api/quests/:id`** — a read-only single-quest read (owner-scoped), returning the full
  quest with tags + sub-tasks in the same shape as a list row, **status-agnostic** (completed
  quests included) so the Chronicles preview can fetch a still-living completed quest; 404 when
  it's gone. Registered after the static `/stats` and `/completions*` GETs so those win the
  route match, never this param.
- **Tags** — user-defined labels pinned to quests (many-to-many via `quest_tags`). A tag has
  a display `name` (as typed), a `normalizedName` (`trim().toLowerCase()`, via `normalizeTagName`
  in shared), and a `color`. A **UNIQUE(`userId`, `normalizedName`)** DB constraint is what makes
  `Dom` / `dom` / ` DOM ` one tag, not three. `POST /api/tags` is **create-or-return** (200 on
  collision, not an error) so on-the-fly creation from the quest form can't race into a duplicate.
  Endpoints live in their own router (`/api/tags`: list-with-`usageCount` / create / update
  (rename and/or recolour) / delete); `GET /api/quests` attaches each quest's `tags:
  [{id,name,color}]` through one batched relational query (no N+1), and quest POST/PATCH take
  `tagIds` (ownership-checked, capped at `MAX_TAGS_PER_QUEST`, **replace** semantics on PATCH).
  The quest form has a Todoist-style combobox (`QuestTagPicker`), the quest list a client-side
  **OR** tag filter in a searchable popover (`QuestTagFilter`, folded into `useQuestFilters`,
  `?tags=` in the URL — unknown ids are pruned from the URL on load), and Status a
  rename/recolour/delete manager (`TagManager`).
  - **Colours: the DB stores the palette KEY, never a hex.** The canonical 15-key palette
    (`TAG_COLORS`) + its hex map (`TAG_COLOR_HEX`) live in `@soloquest/shared/enums`; the column
    is a `pgEnum` (`tag_color`) consuming that tuple — so its order is append-only like every
    other enum. A tag created without a colour gets a deterministic one from its name
    (`tagColorForName`), so on-the-fly tags spread across the palette. The single key→style
    mapping is `apps/web/app/lib/tag-colors.ts` (bound via `:style`, since Tailwind can't
    generate classes from runtime values) — no hex is written in any component.
  - **`usageCount` counts every existing quest with the tag, of any status.** Completing a
    quest keeps its row and pin, so the count only moves on quest create/update/delete (and
    on-the-fly tag create). Freshness is one mechanism: the quests store calls the tags store's
    `invalidate()` from exactly those paths, and the next `load()` (e.g. entering Status) refetches.
- Achievements (streak milestones and lifetime totals), seeded idempotently.
- Per-user timezone (`user_settings`), and a nightly cron that judges yesterday in each
  user's own timezone and resets broken streaks.

---

## Deliberate negative decisions (do not undo)

- **Campaigns are gone from every layer** and stay gone — that scope belongs to the future
  project-management app. Do not reintroduce them. (They survive only in old migration
  files, which are immutable history, not a hint.)
- **Un-completing a quest (undo) is deliberately deferred, not built.** The "DONE TODAY" strip
  and its preview are **read-only** — no undo, uncheck, or un-complete anywhere. Reversing a
  completion touches XP, level and achievements (the app's spine), so it is a separate,
  domain-confirmed decision. Do not add an undo affordance to `DoneQuestRow`, the read-only
  `QuestDetail`, or the complete flow without that decision.
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
  the list. It lives in `useQuestFilters` alongside the ranks (so "is any filter on" and
  "Clear" span both dimensions) and, because it narrows no count, deliberately does **not**
  feed "Showing X of Y" — it shows its own "Sub-tasks hidden" note instead.
- **Tags stay v1-scoped on purpose.** Deliberately *not* built (do not add without a new
  decision): tags on rituals (`recurring_quests`), tag inheritance by sub-tasks, tags in the
  `quest_completions` snapshot / Chronicles, a dedicated tag-management page, and
  `#`-autocomplete in the title. Colours exist but the picker does *not* offer a colour at
  on-the-fly create time (deterministic default + recolour on Status instead — keeps the
  combobox simple). Tags stay `recurring`-free and are a quest-only concern.
- **Priority stays v1-scoped, and it never sorts.** It is a marker + filter, full stop —
  the deadline grouping is the only ordering, and adding a priority sort (within or between
  groups) is a new decision, not a tweak. Deliberately *not* built (do not add without a new
  decision): priority in the `quest_completions` snapshot / Chronicles (a conscious debt, like
  tags), priority on rituals, inheritance by sub-tasks, and a keyboard shortcut to set it. On
  the card, **`normal` renders no marker** on purpose — only high/low get a glyph.
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
