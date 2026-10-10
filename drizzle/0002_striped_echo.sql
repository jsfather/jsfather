ALTER TABLE "exam_questions" ADD COLUMN "difficulty" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "is_final" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_session_id_course_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."course_sessions"("id") ON DELETE cascade ON UPDATE no action;