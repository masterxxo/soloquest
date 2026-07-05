-- Backfill any legacy NULLs before enforcing NOT NULL (SET NOT NULL fails if any NULL remains).
UPDATE "user" SET "xp" = 0 WHERE "xp" IS NULL;--> statement-breakpoint
UPDATE "user" SET "level" = 1 WHERE "level" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "xp" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "level" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "quests_user_id_status_idx" ON "quests" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "quests_parent_id_idx" ON "quests" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "recurring_quest_streaks_user_id_idx" ON "recurring_quest_streaks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_quests_user_id_idx" ON "recurring_quests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements" USING btree ("user_id");