ALTER TABLE "exams" ADD COLUMN "auto_time_limit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "auto_passing_score" boolean DEFAULT false NOT NULL;