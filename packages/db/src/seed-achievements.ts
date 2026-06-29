import { config } from "dotenv"
// Standalone script: load the same root .env drizzle.config.ts uses.
// (cwd is packages/db when run via `pnpm --filter @soloquest/db db:seed-achievements`.)
config({ path: "../../.env" })

import { fileURLToPath } from "url"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { achievements } from "./schema/recurring"

type SeedDb = ReturnType<typeof drizzle>

// Streak milestones: awarded for N consecutive completed days on a single quest.
const STREAK_MILESTONES = [
  { threshold: 5,   title: 'First Streak',         description: '5 days in a row' },
  { threshold: 10,  title: 'Consistent',           description: '10 days in a row' },
  { threshold: 25,  title: 'Dedicated',            description: '25 days in a row' },
  { threshold: 50,  title: 'Unwavering',           description: '50 days in a row' },
  { threshold: 100, title: 'Century',              description: '100 days in a row' },
  { threshold: 250, title: 'Legendary Streak',     description: '250 days in a row' },
  { threshold: 365, title: 'Year of Discipline',   description: '365 days in a row' },
] as const

// Total milestones: awarded for lifetime completion counts on a single quest.
const TOTAL_MILESTONES = [
  { threshold: 25,   title: 'Getting Started', description: '25 total completions' },
  { threshold: 75,   title: 'Building Habits', description: '75 total completions' },
  { threshold: 150,  title: 'Halfway There',   description: '150 total completions' },
  { threshold: 300,  title: 'Three Hundred',   description: '300 total completions' },
  { threshold: 500,  title: 'Five Hundred',    description: '500 total completions' },
  { threshold: 750,  title: 'Relentless',      description: '750 total completions' },
  { threshold: 1000, title: 'Master of Habit', description: '1000 total completions' },
] as const

// xpBonus: 0 for now — bonuses are not wired up yet (kept explicit for future tuning).
const ALL_ACHIEVEMENTS = [
  ...STREAK_MILESTONES.map((m) => ({ ...m, type: 'streak' as const, xpBonus: 0 })),
  ...TOTAL_MILESTONES.map((m) => ({ ...m, type: 'total' as const, xpBonus: 0 })),
]

// Idempotent: insert only achievements whose title isn't already present.
export async function seedAchievements(db: SeedDb) {
  const existing = await db.select({ title: achievements.title }).from(achievements)
  const existingTitles = new Set(existing.map((row) => row.title))

  const toInsert = ALL_ACHIEVEMENTS.filter((a) => !existingTitles.has(a.title))
  if (toInsert.length === 0) {
    console.log('[seed] achievements already up to date — nothing to insert')
    return
  }

  await db.insert(achievements).values(toInsert)
  console.log(`[seed] inserted ${toInsert.length} achievement(s)`)
}

// Run directly: `pnpm --filter @soloquest/db db:seed-achievements`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client)
  seedAchievements(db)
    .then(() => client.end())
    .catch(async (err) => {
      console.error('[seed] failed:', err)
      await client.end()
      process.exit(1)
    })
}
