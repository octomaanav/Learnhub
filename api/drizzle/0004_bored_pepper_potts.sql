ALTER TABLE "lesson_completions" DROP CONSTRAINT "lesson_completions_user_id_lesson_id_unique";--> statement-breakpoint
ALTER TABLE "user_bookmarks" DROP CONSTRAINT "user_bookmarks_user_id_lesson_id_unique";--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD COLUMN "microsection_id" text;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD COLUMN "microsection_id" text;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_user_id_lesson_id_microsection_id_unique" UNIQUE("user_id","lesson_id","microsection_id");--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_lesson_id_microsection_id_unique" UNIQUE("user_id","lesson_id","microsection_id");