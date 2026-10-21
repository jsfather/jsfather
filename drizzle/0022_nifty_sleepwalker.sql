CREATE TABLE "course_chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"key_points" text NOT NULL,
	"questions" text DEFAULT '' NOT NULL,
	"confidence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_review_confidence_valid" CHECK ("session_reviews"."confidence" in ('revisit', 'developing', 'confident'))
);
--> statement-breakpoint
ALTER TABLE "course_sessions" ADD COLUMN "chapter_id" text;--> statement-breakpoint
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_session_id_course_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."course_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_course_id_unique" ON "course_chapters" USING btree ("course_id","id");--> statement-breakpoint
CREATE INDEX "chapter_course_position_idx" ON "course_chapters" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "session_review_history_idx" ON "session_reviews" USING btree ("session_id","created_at");--> statement-breakpoint
ALTER TABLE "course_sessions" ADD CONSTRAINT "session_chapter_same_course" FOREIGN KEY ("course_id","chapter_id") REFERENCES "public"."course_chapters"("course_id","id") ON DELETE no action ON UPDATE no action;