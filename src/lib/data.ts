import 'server-only';
import { and, or, asc, desc, eq, sql, inArray, gte, lt } from 'drizzle-orm';
import { db } from '@/db';
import {
  courses,
  courseSessions,
  exams,
  examAttempts,
  certificates,
  users,
  categoryBanks,
} from '@/db/schema';
import { notFound } from 'next/navigation';
import { canSeeCourse, canSeeProgress, canSeeScores } from './learning';
// Count the attached question bank, excluding generated course assessment copies.
export const sessionQuestionCount = sql<number>`(select count(*)::int from exam_questions q
  inner join exams e on q.exam_id = e.id
  where e.session_id = course_sessions.id)`;
export async function ownedCourse(userId: string, id: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.ownerId, userId)));
  if (!course) notFound();
  return course;
}
export async function accessibleCourse(userId: string, id: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, id),
        or(
          eq(courses.ownerId, userId),
          sql`${courses.kind} = 'vocabulary' and exists (select 1 from vocabulary_members m where m.course_id = courses.id and m.user_id = ${userId})`,
        ),
      ),
    );
  if (!course) notFound();
  return course;
}
export async function ownedSession(userId: string, id: string) {
  const [row] = await db
    .select({ session: courseSessions, course: courses })
    .from(courseSessions)
    .innerJoin(courses, eq(courseSessions.courseId, courses.id))
    .where(and(eq(courseSessions.id, id), eq(courses.ownerId, userId)));
  if (!row) notFound();
  return row;
}
export async function ownedCategoryBank(userId: string, id: string) {
  const [categoryBank] = await db
    .select()
    .from(categoryBanks)
    .where(and(eq(categoryBanks.id, id), eq(categoryBanks.ownerId, userId)));
  if (!categoryBank) notFound();
  return categoryBank;
}
export async function ownedExam(userId: string, id: string) {
  const row = await accessibleExam(userId, id);
  if ((row.course?.ownerId ?? row.categoryBank?.ownerId) !== userId) notFound();
  return row;
}
// Saved attempts remain readable by their learner if an exam is later made private.
export async function accessibleExam(userId: string, id: string, allowPreviousAttempt = false) {
  const [row] = await db
    .select({ exam: exams, course: courses, categoryBank: categoryBanks })
    .from(exams)
    .leftJoin(courses, eq(exams.courseId, courses.id))
    .leftJoin(categoryBanks, eq(exams.categoryBankId, categoryBanks.id))
    .where(
      and(
        eq(exams.id, id),
        or(
          eq(courses.ownerId, userId),
          eq(categoryBanks.ownerId, userId),
          eq(exams.isPublic, true),
          allowPreviousAttempt
            ? sql`exists (select 1 from ${examAttempts} where ${examAttempts.examId} = ${exams.id} and ${examAttempts.userId} = ${userId})`
            : undefined,
        ),
      ),
    );
  if (!row || (!row.course && !row.categoryBank)) notFound();
  return row;
}
export async function courseSummaries(
  userId: string,
  page = 1,
  onlyPublic = false,
  activeOnly = false,
) {
  return db
    .select({
      course: courses,
      total: sql<number>`case when ${courses.kind} = 'book' then ${courses.totalPages}
        when ${courses.kind} = 'vocabulary' then
        (select count(*)::int from vocabulary_words w where w.course_id = courses.id)
        else count(${courseSessions.id})::int end`,
      completed: sql<number>`case when ${courses.kind} = 'book' then ${courses.currentPage}
        when ${courses.kind} = 'vocabulary' then
        (select count(*)::int from vocabulary_words w join vocabulary_progress p on p.word_id = w.id and p.user_id = ${userId}
        where w.course_id = courses.id and p.successful_reviews >= case w.difficulty when 'easy' then 5 when 'hard' then 15 else 10 end)
        else count(${courseSessions.id}) filter (where ${courseSessions.status}='completed')::int end`,
      examStatus: onlyPublic
        ? sql<string>`''`
        : sql<string>`case
        when ${courses.kind} = 'vocabulary' then 'Vocabulary'
        when exists (select 1 from exams e join exam_attempts a on a.exam_id=e.id where e.course_id=${courses.id} and e.is_final=true and a.user_id=${userId} and a.passed=true) then 'Final passed'
        when exists (select 1 from exams e where e.course_id=${courses.id} and e.is_final=true) then 'Final ready'
        when exists (select 1 from exams e where e.course_id=${courses.id}) then 'Exam draft'
        else 'No exam yet' end`,
      practiceSeconds: onlyPublic
        ? sql<number>`0`
        : sql<number>`(select coalesce(sum(p.seconds),0)::int from practice_sessions p where p.user_id = ${userId} and p.course_id = ${courses.id})`,
      nextDate: sql<Date | null>`min(${courseSessions.scheduledDate}) filter (where ${courses.kind} = 'standard' and ${courseSessions.status} in ('upcoming','in_progress') and ${courseSessions.scheduledDate} >= now())`,
    })
    .from(courses)
    .leftJoin(courseSessions, eq(courseSessions.courseId, courses.id))
    .where(
      and(
        onlyPublic
          ? eq(courses.ownerId, userId)
          : or(
              eq(courses.ownerId, userId),
              sql`${courses.kind} = 'vocabulary' and exists (select 1 from vocabulary_members m where m.course_id = courses.id and m.user_id = ${userId})`,
            ),
        onlyPublic ? eq(courses.isPublic, true) : undefined,
        activeOnly ? eq(courses.status, 'active') : undefined,
      ),
    )
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt))
    .limit(12)
    .offset((page - 1) * 12);
}
export async function universityStats(userId: string, onlyPublic = false) {
  const scope = and(
    eq(courses.ownerId, userId),
    onlyPublic ? eq(courses.isPublic, true) : undefined,
  );
  const [sessionStats, courseStats, examStats] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${courseSessions.status}='completed')::int`,
        minutes: sql<number>`coalesce(sum(${courseSessions.duration}) filter (where ${courseSessions.status}='completed'),0)::int`,
      })
      .from(courseSessions)
      .innerJoin(courses, eq(courseSessions.courseId, courses.id))
      .where(and(scope, eq(courses.kind, 'standard'))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where case when courses.kind = 'book' then courses.current_page = courses.total_pages
          when courses.kind = 'vocabulary' then
          exists (select 1 from vocabulary_words w where w.course_id = courses.id) and
          not exists (select 1 from vocabulary_words w left join vocabulary_progress p on p.word_id = w.id and p.user_id = ${userId}
            where w.course_id = courses.id and coalesce(p.successful_reviews, 0) < case w.difficulty when 'easy' then 5 when 'hard' then 15 else 10 end)
          else not exists (select 1 from course_sessions s where s.course_id = courses.id and s.status != 'completed') end)::int`,
      })
      .from(courses)
      .where(
        onlyPublic
          ? scope
          : or(
              eq(courses.ownerId, userId),
              sql`courses.kind = 'vocabulary' and exists (select 1 from vocabulary_members m where m.course_id = courses.id and m.user_id = ${userId})`,
            ),
      ),
    db
      .select({
        passed: sql<number>`count(distinct ${examAttempts.examId}) filter (where ${examAttempts.passed}=true)::int`,
        average: sql<number>`coalesce(round(avg(${examAttempts.percentage})),0)::int`,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .where(and(scope, eq(examAttempts.userId, userId), eq(exams.isFinal, true))),
  ]);
  const s = sessionStats[0],
    c = courseStats[0],
    e = examStats[0];
  return {
    ...s,
    courses: c.total,
    completedCourses: c.completed,
    passedExams: e.passed,
    averageScore: e.average,
    percentage: s.total ? Math.round((s.completed / s.total) * 100) : 0,
  };
}
export async function upcomingSessions(userId: string, limit = 5) {
  return db
    .select({ session: courseSessions, course: courses, questionCount: sessionQuestionCount })
    .from(courseSessions)
    .innerJoin(courses, eq(courseSessions.courseId, courses.id))
    .where(
      and(
        eq(courses.ownerId, userId),
        eq(courses.status, 'active'),
        eq(courses.kind, 'standard'),
        inArray(courseSessions.status, ['upcoming', 'in_progress']),
      ),
    )
    .orderBy(asc(courseSessions.scheduledDate))
    .limit(limit);
}
export async function sessionsBetween(userId: string, start: Date, end: Date) {
  return db
    .select({ session: courseSessions, course: courses, questionCount: sessionQuestionCount })
    .from(courseSessions)
    .innerJoin(courses, eq(courseSessions.courseId, courses.id))
    .where(
      and(
        eq(courses.ownerId, userId),
        eq(courses.kind, 'standard'),
        gte(courseSessions.scheduledDate, start),
        lt(courseSessions.scheduledDate, end),
      ),
    )
    .orderBy(asc(courseSessions.scheduledDate));
}
export async function publicUser(username: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      image: users.image,
      bio: users.bio,
      location: users.location,
      website: users.website,
      githubUrl: users.githubUrl,
      linkedinUrl: users.linkedinUrl,
      createdAt: users.createdAt,
      publicProfile: users.publicProfile,
      publicProgress: users.publicProgress,
      showCourses: users.showCourses,
      showExamScores: users.showExamScores,
    })
    .from(users)
    .where(and(eq(users.username, username), eq(users.publicProfile, true)));
  if (!user) notFound();
  return user;
}
export async function publicCourse(username: string, slug: string) {
  const user = await publicUser(username);
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.ownerId, user.id), eq(courses.slug, slug), eq(courses.isPublic, true)));
  if (!course || !canSeeCourse(user, course)) notFound();
  // Explicit projections keep private notes, schedules, answers, and scores out of public payloads.
  let p: null | { total: number; completed: number; percentage: number } = null;
  let bestScore: number | null = null;
  let certificateId: string | null = null;
  if (course.kind === 'book' && canSeeProgress(user)) {
    p = {
      total: course.totalPages!,
      completed: course.currentPage,
      percentage: Math.round((course.currentPage / course.totalPages!) * 100),
    };
  }
  if (course.kind === 'standard' && canSeeProgress(user)) {
    const [counts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${courseSessions.status}='completed')::int`,
      })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, course.id));
    p = {
      ...counts,
      percentage: counts.total ? Math.round((counts.completed / counts.total) * 100) : 0,
    };
  }
  if (canSeeScores(user)) {
    const [scores] = await db
      .select({ score: sql<number | null>`max(${examAttempts.percentage})` })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .where(
        and(
          eq(exams.courseId, course.id),
          eq(examAttempts.userId, user.id),
          eq(exams.isFinal, true),
        ),
      );
    bestScore = scores.score;
    const [cert] = await db
      .select({ id: certificates.id })
      .from(certificates)
      .where(and(eq(certificates.courseId, course.id), eq(certificates.userId, user.id)))
      .limit(1);
    certificateId = cert?.id ?? null;
  }
  return {
    user,
    course: {
      id: course.id,
      kind: course.kind,
      status: course.status,
      title: course.title,
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      color: course.color,
      totalSessions: course.totalSessions,
      totalPages: course.totalPages,
      bookAuthor: course.bookAuthor,
    },
    progress: p,
    bestScore,
    certificateId,
  };
}
export function pageNumber(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
}
