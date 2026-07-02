import { pgEnum } from "drizzle-orm/pg-core"

// Shared enums live here so quests.ts (and any future tables) can reference them
// without a circular import.
export const difficultyEnum = pgEnum('difficulty', ['E','D','C','B','A','S']);
export const questStatusEnum = pgEnum('quest_status', ['active','completed','failed']);
