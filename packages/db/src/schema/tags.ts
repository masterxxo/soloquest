import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from './auth'
import { quests } from './quests'
import { tagColorEnum } from './enums'

// User-defined labels for quests. `name` is the display spelling exactly as typed ("Dom");
// `normalizedName` is trim().toLowerCase() and is what uniqueness and lookups compare on, so
// `Dom` / `dom` / ` DOM ` collapse to a single tag rather than three near-duplicates. The
// normalization lives in @soloquest/shared (normalizeTagName) — this column just stores it.
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  // Palette KEY, not a hex (see @soloquest/shared TAG_COLORS). NOT NULL with a default so
  // existing rows migrate without a backfill; new tags get a deterministic colour from their
  // name at the API layer (tagColorForName), which overrides this static default.
  color: tagColorEnum('color').notNull().default('amethyst'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  // The real guard against duplicate tags — a hard DB constraint, not just UI validation.
  unique('tags_user_id_normalized_name_unq').on(table.userId, table.normalizedName),
  // Listing a user's tags. (The unique above already indexes user_id as its leftmost
  // prefix, but that one is keyed on normalized_name; this orders/scans by the user alone.)
  index('tags_user_id_idx').on(table.userId),
]);

// Join table: which tags are pinned to which quests (many-to-many). Both sides cascade —
// deleting a quest drops its pins, deleting a tag drops it from every quest (the quests
// themselves stay).
export const questTags = pgTable('quest_tags', {
  questId: uuid('quest_id').notNull().references(() => quests.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  // No quest can pin the same tag twice; the composite PK also indexes lookups by quest
  // (leftmost prefix) for "this quest's tags".
  primaryKey({ columns: [table.questId, table.tagId] }),
  // Reverse lookup by tag, for the per-tag usage count on the tag-management screen.
  index('quest_tags_tag_id_idx').on(table.tagId),
]);

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(user, { fields: [tags.userId], references: [user.id] }),
  questTags: many(questTags),
}));

export const questTagsRelations = relations(questTags, ({ one }) => ({
  quest: one(quests, { fields: [questTags.questId], references: [quests.id] }),
  tag: one(tags, { fields: [questTags.tagId], references: [tags.id] }),
}));
