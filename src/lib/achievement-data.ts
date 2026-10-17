import 'server-only';
import { db } from '@/db';
import {
  courses,
  courseSessions,
  exams,
  examQuestions,
  examAttempts,
  certificates,
  categoryBanks,
  vocabularyProgress,
  vocabularyWords,
} from '@/db/schema';
import { and, or, eq, sql } from 'drizzle-orm';
import { canSeeProgress, canSeeScores } from './learning';
import { achievementsFor } from './achievements';
import { reviewTargets } from './vocabulary';

type Profile = {
  id: string;
  publicProfile: boolean;
  publicProgress: boolean;
  showExamScores: boolean;
};
export async function learningAchievements(
  user: Profile,
  visibility: 'owner' | 'public',
  practice: { totalSeconds: number; best: number },
) {
  const shared = visibility === 'public';
  if (shared && !canSeeProgress(user)) return [];
  const scores = !shared || canSeeScores(user);
  const ownedCourses = and(
    eq(courses.ownerId, user.id),
    shared ? eq(courses.isPublic, true) : undefined,
  );
  const sharedExam = or(
    and(eq(courses.ownerId, user.id), eq(courses.isPublic, true)),
    eq(exams.isPublic, true),
  );
  const [habit, lessons, completed, books, vocabulary, questions, assessments, awards] =
    await Promise.all([
      practice,
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(courseSessions)
        .innerJoin(courses, eq(courseSessions.courseId, courses.id))
        .where(
          and(ownedCourses, eq(courses.kind, 'standard'), eq(courseSessions.status, 'completed')),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(courses)
        .where(
          and(
            ownedCourses,
            eq(courses.kind, 'standard'),
            sql`exists(select 1 from course_sessions s where s.course_id=courses.id)`,
            sql`not exists(select 1 from course_sessions s where s.course_id=courses.id and s.status <> 'completed')`,
          ),
        ),
      db
        .select({
          pages: sql<number>`coalesce(sum(${courses.creditedPages}),0)::int`,
          finished: sql<number>`count(*) filter(where ${courses.totalPages} > 0 and ${courses.currentPage} >= ${courses.totalPages})::int`,
        })
        .from(courses)
        .where(and(ownedCourses, eq(courses.kind, 'book'))),
      db
        .select({
          reviews: sql<number>`coalesce(sum(${vocabularyProgress.totalReviews}),0)::int`,
          mastered: sql<number>`count(*) filter(where ${vocabularyProgress.successfulReviews} >= case ${vocabularyWords.difficulty} when 'easy' then ${reviewTargets.easy}::int when 'hard' then ${reviewTargets.hard}::int else ${reviewTargets.medium}::int end)::int`,
        })
        .from(vocabularyProgress)
        .innerJoin(vocabularyWords, eq(vocabularyProgress.wordId, vocabularyWords.id))
        .innerJoin(courses, eq(vocabularyWords.courseId, courses.id))
        .where(
          and(
            eq(vocabularyProgress.userId, user.id),
            eq(courses.kind, 'vocabulary'),
            shared ? ownedCourses : undefined,
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(examQuestions)
        .innerJoin(exams, eq(examQuestions.examId, exams.id))
        .leftJoin(courses, eq(exams.courseId, courses.id))
        .leftJoin(categoryBanks, eq(exams.categoryBankId, categoryBanks.id))
        .where(
          and(
            eq(exams.isFinal, false),
            eq(exams.isPractice, false),
            or(eq(courses.ownerId, user.id), eq(categoryBanks.ownerId, user.id)),
            shared ? sharedExam : undefined,
          ),
        ),
      scores
        ? db
            .select({
              completed: sql<number>`count(*)::int`,
              passed: sql<number>`count(distinct ${examAttempts.examId}) filter(where ${examAttempts.passed} = true)::int`,
              perfect: sql<number>`count(*) filter(where ${examAttempts.percentage} = 100 and ${examAttempts.maxScore} > 0)::int`,
            })
            .from(examAttempts)
            .innerJoin(exams, eq(examAttempts.examId, exams.id))
            .leftJoin(courses, eq(exams.courseId, courses.id))
            .where(
              and(
                eq(examAttempts.userId, user.id),
                sql`${examAttempts.submittedAt} is not null`,
                shared ? sharedExam : undefined,
              ),
            )
        : [{ completed: 0, passed: 0, perfect: 0 }],
      scores
        ? db
            .select({
              courses: sql<number>`count(distinct ${certificates.courseId})::int`,
              categories: sql<number>`count(distinct ${certificates.categoryBankId})::int`,
            })
            .from(certificates)
            .innerJoin(examAttempts, eq(certificates.attemptId, examAttempts.id))
            .innerJoin(exams, eq(examAttempts.examId, exams.id))
            .leftJoin(courses, eq(certificates.courseId, courses.id))
            .where(and(eq(certificates.userId, user.id), shared ? sharedExam : undefined))
        : [{ courses: 0, categories: 0 }],
    ]);
  const result = achievementsFor(
    {
      focusSeconds: habit.totalSeconds,
      bestStreak: habit.best,
      lessons: lessons[0].count,
      completedCourses: completed[0].count,
      pagesRead: books[0].pages,
      completedBooks: books[0].finished,
      vocabularyReviews: vocabulary[0].reviews,
      masteredWords: vocabulary[0].mastered,
      examsCompleted: assessments[0].completed,
      examsPassed: assessments[0].passed,
      perfectExams: assessments[0].perfect,
      courseCertificates: awards[0].courses,
      categoryCertificates: awards[0].categories,
      questionsWritten: questions[0].count,
    },
    scores,
  );
  return shared ? result.filter((a) => a.earned) : result;
}
