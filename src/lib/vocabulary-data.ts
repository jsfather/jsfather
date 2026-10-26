import 'server-only';
import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { courses, vocabularyWords, vocabularyProgress, vocabularyReviews } from '@/db/schema';

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

export async function vocabularyPracticeCourses(userId: string) {
  return db
    .select({
      courseId: courses.id,
      title: courses.title,
      learn: sql<number>`count(*) filter (where coalesce(${vocabularyProgress.totalReviews}, 0) = 0)::int`,
      review: sql<number>`count(*) filter (where ${vocabularyProgress.totalReviews} > 0)::int`,
    })
    .from(vocabularyWords)
    .innerJoin(courses, eq(courses.id, vocabularyWords.courseId))
    .leftJoin(
      vocabularyProgress,
      and(eq(vocabularyProgress.wordId, vocabularyWords.id), eq(vocabularyProgress.userId, userId)),
    )
    .where(
      and(
        eq(courses.kind, 'vocabulary'),
        eq(courses.status, 'active'),
        or(
          eq(courses.ownerId, userId),
          sql`exists (select 1 from vocabulary_members m where m.course_id = ${courses.id} and m.user_id = ${userId})`,
        ),
        sql`coalesce(${vocabularyProgress.successfulReviews}, 0) < ${vocabularyTargetSql}`,
        sql`(${vocabularyProgress.dueAt} is null or ${vocabularyProgress.dueAt} <= now())`,
      ),
    )
    .groupBy(courses.id, courses.title)
    .orderBy(asc(courses.title), asc(courses.id));
}

export async function vocabularyDueSummary(userId: string) {
  const available = await vocabularyPracticeCourses(userId);
  return available.reduce(
    (summary, course) => ({
      learn: summary.learn + course.learn,
      review: summary.review + course.review,
    }),
    { learn: 0, review: 0 },
  );
}

// Count historical outcomes separately from mastery progress, which can reset when a word changes.
// Library totals include pending reviews; a recall card excludes its current review.
export function vocabularyWordReviewCounts(
  userId: string,
  courseId: string,
  currentReviewId?: string,
) {
  return db
    .select({
      wordId: vocabularyReviews.wordId,
      shown: sql<number>`count(*)::int`.as('shown'),
      successful:
        sql<number>`count(*) filter (where ${vocabularyReviews.submittedAt} is not null and ${vocabularyReviews.remembered} = true)::int`.as(
          'successful',
        ),
      failed:
        sql<number>`count(*) filter (where ${vocabularyReviews.submittedAt} is not null and ${vocabularyReviews.remembered} = false)::int`.as(
          'failed',
        ),
    })
    .from(vocabularyReviews)
    .where(
      and(
        eq(vocabularyReviews.userId, userId),
        eq(vocabularyReviews.courseId, courseId),
        currentReviewId ? ne(vocabularyReviews.id, currentReviewId) : undefined,
      ),
    )
    .groupBy(vocabularyReviews.wordId)
    .as('word_review_counts');
}
