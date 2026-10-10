import 'server-only';
import { and, eq, or, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { courses, vocabularyWords, vocabularyProgress } from '@/db/schema';

export const vocabularyTargetSql = sql<number>`case vocabulary_words.difficulty when 'easy' then 5 when 'hard' then 15 else 10 end`;
export async function accessibleVocabularyCourse(userId: string, courseId: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        eq(courses.kind, 'vocabulary'),
        or(
          eq(courses.ownerId, userId),
          sql`exists (select 1 from vocabulary_members m where m.course_id = courses.id and m.user_id = ${userId})`,
        ),
      ),
    );
  if (!course) notFound();
  return course;
}
export async function vocabularyStats(courseId: string, userId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      mastered: sql<number>`count(*) filter (where coalesce(${vocabularyProgress.successfulReviews}, 0) >= ${vocabularyTargetSql})::int`,
      due: sql<number>`count(*) filter (where coalesce(${vocabularyProgress.successfulReviews}, 0) < ${vocabularyTargetSql} and (${vocabularyProgress.dueAt} is null or ${vocabularyProgress.dueAt} <= now()))::int`,
      nextDue: sql<Date | null>`min(${vocabularyProgress.dueAt}) filter (where ${vocabularyProgress.successfulReviews} < ${vocabularyTargetSql} and ${vocabularyProgress.dueAt} > now())`,
      reviews: sql<number>`coalesce(sum(${vocabularyProgress.totalReviews}), 0)::int`,
    })
    .from(vocabularyWords)
    .leftJoin(
      vocabularyProgress,
      and(eq(vocabularyWords.id, vocabularyProgress.wordId), eq(vocabularyProgress.userId, userId)),
    )
    .where(eq(vocabularyWords.courseId, courseId));
  return stats;
}
