import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from './auth'
// Reuse the shared difficulty enum (declared in enums.ts) — do not redeclare it.
import { difficultyEnum } from './enums'
// Canonical recurrence / achievement tuples live in @soloquest/shared (lightweight /enums entry).
import { ACHIEVEMENT_TYPE, RECURRENCE_TYPE } from "@soloquest/shared/enums"

// How a recurring quest repeats.
// - daily        → every day (recurrenceValue is null)
// - every_x_days → every N days since createdAt (recurrenceValue = N)
// - weekdays     → on specific weekdays (recurrenceValue = bitmask, bit 0 = Mon … bit 6 = Sun)
export const recurrenceTypeEnum = pgEnum('recurrence_type', RECURRENCE_TYPE);

// Achievement category: streak-based (consecutive days) or total-based (lifetime completions).
export const achievementTypeEnum = pgEnum('achievement_type', ACHIEVEMENT_TYPE);

export const recurringQuests = pgTable('recurring_quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  difficulty: difficultyEnum('difficulty').notNull().default('E'),
  recurrenceType: recurrenceTypeEnum('recurrence_type').notNull(),
  // Semantics depend on recurrenceType (see enum doc above):
  // daily → null, every_x_days → interval in days, weekdays → weekday bitmask.
  recurrenceValue: integer('recurrence_value'),
  // Soft-delete flag: deactivated quests stay for history but stop recurring.
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('recurring_quests_user_id_idx').on(table.userId),
]);

export const recurringQuestCompletions = pgTable(
  'recurring_quest_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recurringQuestId: uuid('recurring_quest_id')
      .notNull()
      .references(() => recurringQuests.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    // Calendar date (in the user's timezone) the quest was completed for.
    completedDate: date('completed_date').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  // At most one completion per quest per calendar day.
  (table) => [
    unique('recurring_quest_completions_quest_date_unq').on(
      table.recurringQuestId,
      table.completedDate,
    ),
  ],
);

export const recurringQuestStreaks = pgTable('recurring_quest_streaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  // One streak row per recurring quest.
  recurringQuestId: uuid('recurring_quest_id')
    .notNull()
    .unique()
    .references(() => recurringQuests.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  totalCompletions: integer('total_completions').notNull().default(0),
  lastCompletedDate: date('last_completed_date'),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
}, (table) => [
  index('recurring_quest_streaks_user_id_idx').on(table.userId),
]);

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  // IANA timezone (e.g. 'Europe/Warsaw'); drives "what day is it for this user".
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
});

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: achievementTypeEnum('type').notNull(),
  threshold: integer('threshold').notNull(),
  xpBonus: integer('xp_bonus').notNull().default(0),
  title: text('title').notNull(),
  description: text('description'),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    achievementId: uuid('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    recurringQuestId: uuid('recurring_quest_id')
      .notNull()
      .references(() => recurringQuests.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at').notNull().defaultNow(),
  },
  // An achievement is earned at most once per quest per user.
  (table) => [
    unique('user_achievements_user_achievement_quest_unq').on(
      table.userId,
      table.achievementId,
      table.recurringQuestId,
    ),
    index('user_achievements_user_id_idx').on(table.userId),
  ],
);

// Relations declared on the owning side (same pattern as quests.ts):
// the reciprocal `user hasMany …` would have to live in the Better-Auth-generated
// userRelations (auth.ts), which the CLI regenerates — so we keep app relations out of it.
export const recurringQuestsRelations = relations(recurringQuests, ({ one, many }) => ({
  user: one(user, { fields: [recurringQuests.userId], references: [user.id] }),
  completions: many(recurringQuestCompletions),
  streak: one(recurringQuestStreaks),
  userAchievements: many(userAchievements),
}));

export const recurringQuestCompletionsRelations = relations(
  recurringQuestCompletions,
  ({ one }) => ({
    recurringQuest: one(recurringQuests, {
      fields: [recurringQuestCompletions.recurringQuestId],
      references: [recurringQuests.id],
    }),
    user: one(user, {
      fields: [recurringQuestCompletions.userId],
      references: [user.id],
    }),
  }),
);

export const recurringQuestStreaksRelations = relations(
  recurringQuestStreaks,
  ({ one }) => ({
    recurringQuest: one(recurringQuests, {
      fields: [recurringQuestStreaks.recurringQuestId],
      references: [recurringQuests.id],
    }),
  }),
);

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(user, { fields: [userAchievements.userId], references: [user.id] }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
  recurringQuest: one(recurringQuests, {
    fields: [userAchievements.recurringQuestId],
    references: [recurringQuests.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));
