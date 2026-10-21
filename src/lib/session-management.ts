import type { db } from '@/db';
import { courses, courseSessions, courseChapters } from '@/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import type { Course } from '@/db/schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SessionFields = Pick<
  typeof courseSessions.$inferInsert,
  | 'chapterId'
  | 'title'
  | 'description'
  | 'scheduledDate'
  | 'duration'
  | 'notes'
  | 'status'
  | 'completedAt'
>;

// Call after acquiring the course row lock so session mutations and schedule rebuilds serialize.
export async function syncCourseSessions(tx: Transaction, course: Pick<Course, 'id' | 'timezone'>) {
  const sessions = await tx
    .select()
    .from(courseSessions)
    .where(eq(courseSessions.courseId, course.id))
    .orderBy(asc(courseSessions.sessionNumber));
  for (const [index, session] of sessions.entries()) {
    if (session.sessionNumber !== index + 1)
      await tx
        .update(courseSessions)
        .set({ sessionNumber: index + 1 })
        .where(eq(courseSessions.id, session.id));
  }
  const latest = sessions.reduce<Date | null>(
    (date, session) => (!date || session.scheduledDate > date ? session.scheduledDate : date),
    null,
  );
  await tx
    .update(courses)
    .set({
      totalSessions: sessions.length,
      endDate: latest ? formatInTimeZone(latest, course.timezone, 'yyyy-MM-dd') : null,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, course.id));
}

export async function validateChapter(
  tx: Transaction,
  courseId: string,
  chapterId: string | null | undefined,
) {
  if (!chapterId) return;
  const [chapter] = await tx
    .select({ id: courseChapters.id })
    .from(courseChapters)
    .where(and(eq(courseChapters.id, chapterId), eq(courseChapters.courseId, courseId)));
  if (!chapter) throw new Error('Chapter does not belong to this course.');
}

export async function addCourseSessions(tx: Transaction, course: Course, fields: SessionFields[]) {
  await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, course.id)).for('update');
  for (const chapterId of new Set(fields.map((field) => field.chapterId))) {
    await validateChapter(tx, course.id, chapterId);
  }
  const [last] = await tx
    .select({ number: sql<number>`coalesce(max(${courseSessions.sessionNumber}), 0)::int` })
    .from(courseSessions)
    .where(eq(courseSessions.courseId, course.id));
  const sessions = await tx
    .insert(courseSessions)
    .values(
      fields.map((field, index) => ({
        ...field,
        courseId: course.id,
        sessionNumber: last.number + index + 1,
      })),
    )
    .returning();
  await syncCourseSessions(tx, course);
  return sessions;
}

export async function addCourseSession(tx: Transaction, course: Course, fields: SessionFields) {
  return (await addCourseSessions(tx, course, [fields]))[0];
}

export async function removeCourseSession(tx: Transaction, course: Course, id: string) {
  await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, course.id)).for('update');
  await tx.delete(courseSessions).where(eq(courseSessions.id, id));
  await syncCourseSessions(tx, course);
}
