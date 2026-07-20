CREATE TYPE "public"."quest_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "priority" "quest_priority" DEFAULT 'normal' NOT NULL;