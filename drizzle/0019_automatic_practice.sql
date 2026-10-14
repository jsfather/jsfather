ALTER TABLE "courses" ADD COLUMN "credited_pages" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "day" text;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_source_key_unique" UNIQUE("source_key");
--> statement-breakpoint
-- Stop legacy timers. Keep their earned time, and avoid backfilling the same
-- course/activity where measured time already exists.
UPDATE practice_sessions SET ended_at = now() WHERE ended_at IS NULL;
--> statement-breakpoint
UPDATE courses SET credited_pages = current_page WHERE kind = 'book';
--> statement-breakpoint
WITH outcomes AS (
  SELECT 'lesson:' || s.id AS source_key, c.owner_id AS user_id, c.id AS course_id,
    'lesson' AS activity, s.duration * 60 AS seconds,
    coalesce(s.completed_at, s.updated_at) AS at
  FROM course_sessions s JOIN courses c ON c.id = s.course_id
  WHERE s.status = 'completed' AND c.kind = 'standard'
  UNION ALL
  SELECT 'vocabulary:' || r.id, r.user_id, r.course_id, 'vocabulary', 30, r.submitted_at
  FROM vocabulary_reviews r WHERE r.submitted_at IS NOT NULL
  UNION ALL
  SELECT 'book:' || c.id || ':' || c.current_page, c.owner_id, c.id, 'reading', c.current_page * 120, c.updated_at
  FROM courses c WHERE c.kind = 'book' AND c.current_page > 0
  UNION ALL
  SELECT 'exam:' || a.id, a.user_id, e.course_id, 'exam',
    greatest(0, least(extract(epoch FROM (a.submitted_at-a.started_at))::integer,
      coalesce((a.snapshot->>'timeLimit')::integer, e.time_limit) * 60)), a.submitted_at
  FROM exam_attempts a JOIN exams e ON e.id = a.exam_id WHERE a.submitted_at IS NOT NULL
), added AS (
  INSERT INTO practice_sessions (id,user_id,course_id,source_key,activity,seconds,day,started_at,last_heartbeat_at,ended_at)
  SELECT 'estimate-' || o.source_key, o.user_id, o.course_id, o.source_key, o.activity,
    CASE WHEN EXISTS(SELECT 1 FROM practice_sessions p WHERE p.user_id=o.user_id AND p.course_id=o.course_id AND p.activity=o.activity AND p.source_key IS NULL AND p.seconds>0)
      THEN 0 ELSE o.seconds END,
    to_char(o.at AT TIME ZONE u.timezone, 'YYYY-MM-DD'), o.at, o.at, o.at
  FROM outcomes o JOIN users u ON u.id=o.user_id
  ON CONFLICT (source_key) DO NOTHING
  RETURNING user_id,day,seconds
)
INSERT INTO practice_days (user_id,day,seconds)
SELECT user_id,day,sum(seconds)::integer FROM added WHERE seconds>0 GROUP BY user_id,day
ON CONFLICT (user_id,day) DO UPDATE SET seconds=practice_days.seconds+excluded.seconds;
