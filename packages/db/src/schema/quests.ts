import { pgTable, uuid, text, integer, timestamp, index, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from './auth'
import { difficultyEnum, questStatusEnum } from './enums'

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

export const questsRelations = relations(quests, ({ one, many }) => ({
  user: one(user, { fields: [quests.userId], references: [user.id] }),
  // self-reference: belongsTo parent quest (nullable) + hasMany sub-tasks
  parent: one(quests, {
    fields: [quests.parentId],
    references: [quests.id],
    relationName: 'questSubTasks',
  }),
  subTasks: many(quests, { relationName: 'questSubTasks' }),
}));