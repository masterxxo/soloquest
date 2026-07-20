import { pgEnum } from "drizzle-orm/pg-core"
// Canonical enum tuples live in @soloquest/shared (the lightweight /enums entry, so no
// Zod/runtime is pulled into migrations). Postgres stores enum order — keep it in sync there.
import { DIFFICULTY_ORDER, QUEST_STATUS, QUEST_PRIORITY, TAG_COLORS } from "@soloquest/shared/enums"

// Shared enums live here so quests.ts (and any future tables) can reference them
// without a circular import.
export const difficultyEnum = pgEnum('difficulty', DIFFICULTY_ORDER);
export const questStatusEnum = pgEnum('quest_status', QUEST_STATUS);
export const questPriorityEnum = pgEnum('quest_priority', QUEST_PRIORITY);
export const tagColorEnum = pgEnum('tag_color', TAG_COLORS);
