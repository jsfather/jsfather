-- Consolidate existing session question banks without losing questions or results.
-- Drizzle runs migrations transactionally; these locks prevent concurrent exam edits.
LOCK TABLE "exams", "exam_questions", "exam_options", "exam_attempts" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT e.session_id, a.user_id
    FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
    WHERE e.session_id IS NOT NULL AND a.submitted_at IS NULL
    GROUP BY e.session_id, a.user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Finish overlapping active attempts for the same session before migrating to one exam per session.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TEMP TABLE session_exam_merge ON COMMIT DROP AS
SELECT id AS old_id, session_id,
       first_value(id) OVER (PARTITION BY session_id ORDER BY created_at, id) AS keep_id
FROM exams WHERE session_id IS NOT NULL;
--> statement-breakpoint
-- Freeze legacy active attempts before combining their question banks.
UPDATE exam_attempts a
SET snapshot = jsonb_build_object(
  'timeLimit', e.time_limit,
  'passingScore', e.passing_score,
  'questions', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id, 'question', q.question, 'type', q.type, 'points', q.points,
      'explanation', q.explanation, 'timeSeconds', q.time_seconds,
      'acceptedAnswers', q.accepted_answers, 'caseSensitive', q.case_sensitive,
      'tolerance', q.tolerance, 'pairs', q.pairs,
      'options', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', o.id, 'text', o.text, 'isCorrect', o.is_correct
        ) ORDER BY o."order") FROM exam_options o WHERE o.question_id = q.id
      ), '[]'::jsonb)
    ) ORDER BY q."order") FROM exam_questions q WHERE q.exam_id = e.id
  ), '[]'::jsonb)
)
FROM exams e JOIN session_exam_merge m ON m.old_id = e.id
WHERE a.exam_id = e.id AND a.snapshot IS NULL AND a.submitted_at IS NULL;
--> statement-breakpoint
DROP INDEX "questions_order_idx";
--> statement-breakpoint
WITH ordered AS (
  SELECT q.id, m.keep_id,
         row_number() OVER (
           PARTITION BY m.keep_id ORDER BY e.created_at, e.id, q."order", q.id
         ) - 1 AS new_order
  FROM exam_questions q
  JOIN exams e ON e.id = q.exam_id
  JOIN session_exam_merge m ON m.old_id = e.id
)
UPDATE exam_questions q SET exam_id = o.keep_id, "order" = o.new_order
FROM ordered o WHERE o.id = q.id;
--> statement-breakpoint
CREATE UNIQUE INDEX "questions_order_idx" ON "exam_questions" ("exam_id", "order");
--> statement-breakpoint
UPDATE exam_attempts a SET exam_id = m.keep_id
FROM session_exam_merge m WHERE a.exam_id = m.old_id AND m.old_id <> m.keep_id;
--> statement-breakpoint
DELETE FROM exams e USING session_exam_merge m
WHERE e.id = m.old_id AND m.old_id <> m.keep_id;
--> statement-breakpoint
WITH totals AS (
  SELECT q.exam_id, greatest(1, ceil(sum(q.time_seconds)::numeric / 60)) AS minutes,
         round(sum(q.points * CASE q.difficulty WHEN 'easy' THEN 80 WHEN 'hard' THEN 60 ELSE 70 END)::numeric / sum(q.points)) AS passing
  FROM exam_questions q GROUP BY q.exam_id
)
UPDATE exams e
SET title = left(s.title, 140) || ' · Questions',
    time_limit = CASE WHEN e.auto_time_limit THEN coalesce(t.minutes, e.time_limit)::integer ELSE e.time_limit END,
    passing_score = CASE WHEN e.auto_passing_score THEN coalesce(t.passing, e.passing_score)::integer ELSE e.passing_score END,
    updated_at = now()
FROM course_sessions s LEFT JOIN session_exam_merge m ON m.session_id = s.id AND m.old_id = m.keep_id
LEFT JOIN totals t ON t.exam_id = m.keep_id
WHERE e.id = m.keep_id;
--> statement-breakpoint
CREATE UNIQUE INDEX "exams_session_unique" ON "exams" ("session_id");
