CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "topic_id" text;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "topic_id" text;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "topics_owner_category_idx" ON "topics" USING btree ("owner_id","category");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exams_topic_unique" ON "exams" USING btree ("topic_id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificate_scope_valid" CHECK (("certificates"."course_id" is not null) <> ("certificates"."topic_id" is not null));--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exam_scope_valid" CHECK (("exams"."course_id" is not null and "exams"."topic_id" is null) or ("exams"."course_id" is null and "exams"."topic_id" is not null and "exams"."session_id" is null and not "exams"."is_final" and not "exams"."is_practice"));