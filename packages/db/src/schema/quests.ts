import { pgTable, uuid, text, integer, timestamp, index, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from './auth'
import { difficultyEnum, questStatusEnum } from './enums'
import { questTags } from './tags'

export const quests = pgTable('quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // Sub-tasks point at a parent quest; deleting the parent removes its sub-tasks.
  parentId: uuid('parent_id').references((): AnyPgColumn => quests.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  difficulty: difficultyEnum('difficulty').notNull().default('E'),
  status: questStatusEnum('status').notNull().default('active'),
  xpReward: integer('xp_reward').notNull(),
  deadline: timestamp('deadline'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  // Composite covers both the per-user list (leftmost prefix on user_id) and the
  // status-filtered list, so no separate user_id index is needed.
  index('quests_user_id_status_idx').on(table.userId, table.status),
  // Sub-task lookup by parent quest.
  index('quests_parent_id_idx').on(table.parentId),
]);

// Append-only log of completion events, one row per completed quest. Deliberately not a
// counter: title, difficulty and xpAwarded are snapshotted at completion time so a row
// still describes the achievement after the quest it came from is edited or deleted —
// which is what the future Chronicles view reads.
export const questCompletions = pgTable('quest_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // Nullable + SET NULL on purpose (never cascade): deleting the quest must not erase
  // the fact that it was completed. The link is a convenience, not the source of truth.
  questId: uuid('quest_id').references((): AnyPgColumn => quests.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  difficulty: difficultyEnum('difficulty').notNull(),
  xpAwarded: integer('xp_awarded').notNull(),
  completedAt: timestamp('completed_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('quest_completions_user_id_idx').on(table.userId),
  // Chronicles: a user's completions in reverse-chronological order.
  index('quest_completions_user_id_completed_at_idx').on(table.userId, table.completedAt),
]);

export const questsRelations = relations(quests, ({ one, many }) => ({
  user: one(user, { fields: [quests.userId], references: [user.id] }),
  // self-reference: belongsTo parent quest (nullable) + hasMany sub-tasks
  parent: one(quests, {
    fields: [quests.parentId],
    references: [quests.id],
    relationName: 'questSubTasks',
  }),
  subTasks: many(quests, { relationName: 'questSubTasks' }),
  completions: many(questCompletions),
  questTags: many(questTags),
}));

export const questCompletionsRelations = relations(questCompletions, ({ one }) => ({
  user: one(user, { fields: [questCompletions.userId], references: [user.id] }),
  // Nullable: the quest may be long gone — the snapshot columns still hold.
  quest: one(quests, { fields: [questCompletions.questId], references: [quests.id] }),
}));