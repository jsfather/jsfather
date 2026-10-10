-- Rename existing course and session assessments without changing their questions or attempts.
UPDATE exams e
SET title = c.title || CASE
  WHEN e.session_id IS NOT NULL THEN ' ' || s.title || ' practice assessment'
  WHEN e.is_final THEN ' final assessment'
  ELSE ' practice assessment'
END, updated_at = now()
FROM courses c LEFT JOIN course_sessions s ON s.course_id = c.id
WHERE e.course_id = c.id
  AND (e.session_id = s.id OR e.session_id IS NULL);
