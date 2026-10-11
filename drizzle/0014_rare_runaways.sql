ALTER TABLE "vocabulary_members" ADD COLUMN "role" text DEFAULT 'collaborator' NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD COLUMN "persian_meaning" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD COLUMN "awl_sublist" integer;--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD COLUMN "related_forms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD COLUMN "source_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_members" ADD CONSTRAINT "vocabulary_member_role_valid" CHECK ("vocabulary_members"."role" in ('collaborator', 'learner'));--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_awl_sublist_valid" CHECK ("vocabulary_words"."awl_sublist" between 1 and 10);
