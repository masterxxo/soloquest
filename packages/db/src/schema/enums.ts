import { pgEnum } from "drizzle-orm/pg-core"

// Shared enums live here so quests.ts and campaigns.ts can both reference them
// without a circular import (campaigns reuses difficultyEnum at table-build time).
export const difficultyEnum = pgEnum('difficulty', ['E','D','C','B','A','S']);
export const questStatusEnum = pgEnum('quest_status', ['active','completed','failed']);
