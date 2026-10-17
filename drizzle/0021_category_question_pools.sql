ALTER TABLE "topics" RENAME TO "category_banks";--> statement-breakpoint
ALTER TABLE "certificates" RENAME COLUMN "topic_id" TO "category_bank_id";--> statement-breakpoint
ALTER TABLE "exams" RENAME COLUMN "topic_id" TO "category_bank_id";--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT "certificate_scope_valid";--> statement-breakpoint
ALTER TABLE "exams" DROP CONSTRAINT "exam_scope_valid";--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_topic_id_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "exams" DROP CONSTRAINT "exams_topic_id_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "category_banks" DROP CONSTRAINT "topics_owner_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "exams_topic_unique";--> statement-breakpoint
DROP INDEX "topics_owner_category_idx";--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_category_bank_id_category_banks_id_fk" FOREIGN KEY ("category_bank_id") REFERENCES "public"."category_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_category_bank_id_category_banks_id_fk" FOREIGN KEY ("category_bank_id") REFERENCES "public"."category_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_banks" ADD CONSTRAINT "category_banks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exams_category_bank_unique" ON "exams" USING btree ("category_bank_id") WHERE not "exams"."is_final" and not "exams"."is_practice";--> statement-breakpoint
CREATE UNIQUE INDEX "category_banks_owner_category_idx" ON "category_banks" USING btree ("owner_id","category");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificate_scope_valid" CHECK (("certificates"."course_id" is not null) <> ("certificates"."category_bank_id" is not null));--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exam_scope_valid" CHECK (("exams"."course_id" is not null and "exams"."category_bank_id" is null) or ("exams"."course_id" is null and "exams"."category_bank_id" is not null and "exams"."session_id" is null ));
--> statement-breakpoint
UPDATE exams e SET title = b.category || ' · Category questions' FROM category_banks b WHERE e.category_bank_id = b.id AND NOT e.is_final AND NOT e.is_practice;
