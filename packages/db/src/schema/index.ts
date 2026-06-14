import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core"

export const difficultyEnum = pgEnum('difficulty', ['E','D','C','B','A','S']);
export const questStatusEnum = pgEnum('quest_status', ['active','completed','failed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  username: text('username').notNull(),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const quests = pgTable('quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  difficulty: difficultyEnum('difficulty').notNull().default('E'),
  status: questStatusEnum('status').notNull().default('active'),
  xpReward: integer('xp_reward').notNull(),
  deadline: timestamp('deadline'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
