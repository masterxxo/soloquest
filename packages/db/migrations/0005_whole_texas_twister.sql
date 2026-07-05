ALTER TABLE "campaigns" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "campaigns" CASCADE;--> statement-breakpoint
ALTER TABLE "quests" DROP CONSTRAINT IF EXISTS "quests_campaign_id_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "quests" DROP COLUMN "campaign_id";--> statement-breakpoint
DROP TYPE "public"."campaign_status";