import { sql } from 'drizzle-orm';
import type { db } from '@/db';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function syncAssessmentNames(tx: Tx, courseId: string) {
  await tx.execute(sql`update exams e set title = c.title ||
    case when e.session_id is not null then ' ' || s.title || ' practice assessment'
      when e.is_final then ' final assessment' else ' practice assessment' end,
    updated_at = now()
    from courses c left join course_sessions s on s.course_id = c.id
    where e.course_id = c.id and c.id = ${courseId}
      and (e.session_id = s.id or e.session_id is null)`);
}
