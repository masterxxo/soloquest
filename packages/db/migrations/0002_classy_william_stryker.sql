CREATE TYPE "public"."campaign_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" "difficulty" DEFAULT 'E' NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"deadline" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_parent_id_quests_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;