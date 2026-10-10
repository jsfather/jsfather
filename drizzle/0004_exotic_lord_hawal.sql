ALTER TYPE "public"."question_type" ADD VALUE 'multiple_select';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'short_answer';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'fill_blank';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'numeric';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'ordering';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'matching';--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "time_seconds" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "accepted_answers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "case_sensitive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "tolerance" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "pairs" jsonb DEFAULT '[]'::jsonb NOT NULL;