ALTER TABLE "courses" DROP CONSTRAINT "course_count_positive";--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "course_count_nonnegative" CHECK ("courses"."total_sessions">=0);