CREATE TABLE "vocabulary_members" (
	"course_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocabulary_members_course_id_user_id_pk" PRIMARY KEY("course_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_progress" (
	"word_id" text NOT NULL,
	"user_id" text NOT NULL,
	"successful_reviews" integer DEFAULT 0 NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	CONSTRAINT "vocabulary_progress_word_id_user_id_pk" PRIMARY KEY("word_id","user_id"),
	CONSTRAINT "vocabulary_progress_counts" CHECK ("vocabulary_progress"."successful_reviews" >= 0 and "vocabulary_progress"."total_reviews" >= "vocabulary_progress"."successful_reviews")
);
--> statement-breakpoint
CREATE TABLE "vocabulary_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"word_id" text NOT NULL,
	"user_id" text NOT NULL,
	"word_version" integer NOT NULL,
	"word_snapshot" jsonb NOT NULL,
	"direction" text NOT NULL,
	"revealed_at" timestamp with time zone,
	"remembered" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "vocabulary_review_direction" CHECK ("vocabulary_reviews"."direction" in ('word', 'meaning'))
);
--> statement-breakpoint
CREATE TABLE "vocabulary_words" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"word" text NOT NULL,
	"explanation" text NOT NULL,
	"example" text DEFAULT '' NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"added_on" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocabulary_difficulty_valid" CHECK ("vocabulary_words"."difficulty" in ('easy', 'medium', 'hard')),
	CONSTRAINT "vocabulary_version_positive" CHECK ("vocabulary_words"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "kind" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary_members" ADD CONSTRAINT "vocabulary_members_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_members" ADD CONSTRAINT "vocabulary_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_progress" ADD CONSTRAINT "vocabulary_progress_word_id_vocabulary_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."vocabulary_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_progress" ADD CONSTRAINT "vocabulary_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_reviews" ADD CONSTRAINT "vocabulary_reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_reviews" ADD CONSTRAINT "vocabulary_reviews_word_id_vocabulary_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."vocabulary_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_reviews" ADD CONSTRAINT "vocabulary_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_words_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vocabulary_members_user_idx" ON "vocabulary_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vocabulary_progress_user_due_idx" ON "vocabulary_progress" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vocabulary_review_pending" ON "vocabulary_reviews" USING btree ("course_id","user_id") WHERE "vocabulary_reviews"."submitted_at" is null;--> statement-breakpoint
CREATE INDEX "vocabulary_reviews_user_idx" ON "vocabulary_reviews" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "vocabulary_words_course_idx" ON "vocabulary_words" USING btree ("course_id","added_on");--> statement-breakpoint
CREATE UNIQUE INDEX "vocabulary_word_unique" ON "vocabulary_words" USING btree ("course_id",lower(trim("word")));--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "course_kind_valid" CHECK ("courses"."kind" in ('standard', 'vocabulary'));