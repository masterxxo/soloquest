import { pgTable, uuid, text, integer, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from './auth'
import { campaigns } from './campaigns'
import { difficultyEnum, questStatusEnum } from './enums'

export const quests = pgTable('quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // A quest may belong to a campaign; if the campaign is deleted the quest survives.
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
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
});

export const questsRelations = relations(quests, ({ one, many }) => ({
  user: one(user, { fields: [quests.userId], references: [user.id] }),
  // belongsTo campaign (nullable)
  campaign: one(campaigns, { fields: [quests.campaignId], references: [campaigns.id] }),
  // self-reference: belongsTo parent quest (nullable) + hasMany sub-tasks
  parent: one(quests, {
    fields: [quests.parentId],
    references: [quests.id],
    relationName: 'questSubTasks',
  }),
  subTasks: many(quests, { relationName: 'questSubTasks' }),
}));