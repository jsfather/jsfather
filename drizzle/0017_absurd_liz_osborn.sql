CREATE TABLE "practice_days" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "practice_days_user_id_day_pk" PRIMARY KEY("user_id","day"),
	CONSTRAINT "practice_day_seconds_valid" CHECK ("practice_days"."seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text,
	"activity" text NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "practice_seconds_valid" CHECK ("practice_sessions"."seconds" >= 0 and "practice_sessions"."last_sequence" >= 0),
	CONSTRAINT "practice_activity_valid" CHECK ("practice_sessions"."activity" in ('lesson', 'reading', 'vocabulary', 'exam'))
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_streak_day" text;--> statement-breakpoint
ALTER TABLE "practice_days" ADD CONSTRAINT "practice_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "practice_one_active_per_user" ON "practice_sessions" USING btree ("user_id") WHERE "practice_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "practice_user_course_idx" ON "practice_sessions" USING btree ("user_id","course_id");