CREATE TABLE "quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" uuid,
	"title" text NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"xp_awarded" integer NOT NULL,
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quest_completions_user_id_idx" ON "quest_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quest_completions_user_id_completed_at_idx" ON "quest_completions" USING btree ("user_id","completed_at");--> statement-breakpoint
-- Backfill: replay the quests already completed before this log existed, so the counter
-- reflects the full account history rather than starting from zero. Hand-written —
-- drizzle-kit only emits DDL. Runs in the same migration so prod and local converge
-- through one path.
INSERT INTO "quest_completions" ("id", "user_id", "quest_id", "title", "difficulty", "xp_awarded", "completed_at")
SELECT gen_random_uuid(), "user_id", "id", "title", "difficulty", "xp_reward", "completed_at"
FROM "quests"
WHERE "status" = 'completed' AND "completed_at" IS NOT NULL;