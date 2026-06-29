CREATE TYPE "public"."achievement_type" AS ENUM('streak', 'total');--> statement-breakpoint
CREATE TYPE "public"."recurrence_type" AS ENUM('daily', 'every_x_days', 'weekdays');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "achievement_type" NOT NULL,
	"threshold" integer NOT NULL,
	"xp_bonus" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "recurring_quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_quest_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"completed_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_quest_completions_quest_date_unq" UNIQUE("recurring_quest_id","completed_date")
);
--> statement-breakpoint
CREATE TABLE "recurring_quest_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_quest_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"total_completions" integer DEFAULT 0 NOT NULL,
	"last_completed_date" date,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_quest_streaks_recurring_quest_id_unique" UNIQUE("recurring_quest_id")
);
--> statement-breakpoint
CREATE TABLE "recurring_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" "difficulty" DEFAULT 'E' NOT NULL,
	"recurrence_type" "recurrence_type" NOT NULL,
	"recurrence_value" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"achievement_id" uuid NOT NULL,
	"recurring_quest_id" uuid NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_achievement_quest_unq" UNIQUE("user_id","achievement_id","recurring_quest_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_quest_completions" ADD CONSTRAINT "recurring_quest_completions_recurring_quest_id_recurring_quests_id_fk" FOREIGN KEY ("recurring_quest_id") REFERENCES "public"."recurring_quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_quest_completions" ADD CONSTRAINT "recurring_quest_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_quest_streaks" ADD CONSTRAINT "recurring_quest_streaks_recurring_quest_id_recurring_quests_id_fk" FOREIGN KEY ("recurring_quest_id") REFERENCES "public"."recurring_quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_quest_streaks" ADD CONSTRAINT "recurring_quest_streaks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_quests" ADD CONSTRAINT "recurring_quests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_recurring_quest_id_recurring_quests_id_fk" FOREIGN KEY ("recurring_quest_id") REFERENCES "public"."recurring_quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;