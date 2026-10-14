import { db } from '@/db';
import { courses, courseSessions, exams, examAttempts, certificates, users } from '@/db/schema';
import { and, eq, sql, desc } from 'drizzle-orm';

export async function issueEligibleCertificate(courseId: string, userId: string) {
  await db.transaction(async (tx) => {
    const [course] = await tx
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.ownerId, userId)))
      .for('update');
    if (!course) return;
    const sessions = await tx
      .select({ status: courseSessions.status })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, courseId))
      .for('share');
    if (!sessions.length || sessions.some((session) => session.status !== 'completed')) return;
    const [attempt] = await tx
      .select({ id: examAttempts.id, percentage: examAttempts.percentage })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .where(
        and(
          eq(exams.courseId, courseId),
          eq(exams.isFinal, true),
          eq(examAttempts.userId, userId),
          eq(examAttempts.passed, true),
          sql`coalesce((${examAttempts.snapshot}->>'practiceOnly')::boolean, false) = false`,
        ),
      )
      .orderBy(desc(examAttempts.submittedAt))
      .limit(1);
    if (!attempt || attempt.percentage === null) return;
    const [user] = await tx
      .select({ name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, userId));
    await tx
      .insert(certificates)
      .values({
        attemptId: attempt.id,
        userId,
        courseId,
        recipientName: user.name ?? user.username,
        courseTitle: course.title,
        percentage: attempt.percentage,
      })
      .onConflictDoNothing();
  });
}
