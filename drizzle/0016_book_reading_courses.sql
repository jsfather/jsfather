CREATE TABLE "book_bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"page" integer NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_bookmark_page_positive" CHECK ("book_bookmarks"."page" > 0)
);
--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "course_kind_valid";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "book_author" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "total_pages" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "current_page" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "reading_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "book_bookmarks" ADD CONSTRAINT "book_bookmarks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_bookmarks_course_idx" ON "book_bookmarks" USING btree ("course_id","page");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "book_pages_valid" CHECK ("courses"."current_page" >= 0 and ("courses"."kind" <> 'book' or ("courses"."total_pages" is not null and "courses"."total_pages" > 0 and "courses"."current_page" <= "courses"."total_pages")));--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "course_kind_valid" CHECK ("courses"."kind" in ('standard', 'vocabulary', 'book'));