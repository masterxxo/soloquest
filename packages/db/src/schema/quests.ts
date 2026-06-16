import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core"
import { user } from './auth'

export const difficultyEnum = pgEnum('difficulty', ['E','D','C','B','A','S']);
export const questStatusEnum = pgEnum('quest_status', ['active','completed','failed']);

export const quests = pgTable('quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  difficulty: difficultyEnum('difficulty').notNull().default('E'),
  status: questStatusEnum('status').notNull().default('active'),
  xpReward: integer('xp_reward').notNull(),
  deadline: timestamp('deadline'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});