import 'server-only';
import { and, asc, desc, eq, sql, inArray, gte, lt } from 'drizzle-orm';
import { db } from '@/db';
import { courses, courseSessions, exams, examAttempts, certificates, users } from '@/db/schema';
import { notFound } from 'next/navigation';
import { canSeeCourse, canSeeProgress, canSeeScores } from './learning';
export async function ownedCourse(userId: string, id: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.ownerId, userId)));
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
export async function ownedExam(userId: string, id: string) {
  const [row] = await db
    .select({ exam: exams, course: courses })
    .from(exams)
    .innerJoin(courses, eq(exams.courseId, courses.id))
    .where(and(eq(exams.id, id), eq(courses.ownerId, userId)));
  if (!row) notFound();
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
      total: sql<number>`count(${courseSessions.id})::int`,
      completed: sql<number>`count(${courseSessions.id}) filter (where ${courseSessions.status}='completed')::int`,
      examStatus: onlyPublic
        ? sql<string>`''`
        : sql<string>`case
        when exists (select 1 from exams e join exam_attempts a on a.exam_id=e.id where e.course_id=${courses.id} and a.user_id=${userId} and a.passed=true) then 'Exam passed'
        when exists (select 1 from exams e where e.course_id=${courses.id} and e.published=true) then 'Exam ready'
        when exists (select 1 from exams e where e.course_id=${courses.id}) then 'Exam draft'
        else 'No exam yet' end`,
      nextDate: sql<Date | null>`min(${courseSessions.scheduledDate}) filter (where ${courseSessions.status} in ('upcoming','in_progress') and ${courseSessions.scheduledDate} >= now())`,
    })
    .from(courses)
    .leftJoin(courseSessions, eq(courseSessions.courseId, courses.id))
    .where(
      and(
        eq(courses.ownerId, userId),
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
      .where(scope),
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where not exists (select 1 from course_sessions s where s.course_id = "courses"."id" and s.status != 'completed'))::int`,
      })
      .from(courses)
      .where(scope),
    db
      .select({
        passed: sql<number>`count(distinct ${examAttempts.examId}) filter (where ${examAttempts.passed}=true)::int`,
        average: sql<number>`coalesce(round(avg(${examAttempts.percentage})),0)::int`,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .where(and(scope, eq(examAttempts.userId, userId))),
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
    .select({ session: courseSessions, course: courses })
    .from(courseSessions)
    .innerJoin(courses, eq(courseSessions.courseId, courses.id))
    .where(
      and(
        eq(courses.ownerId, userId),
        eq(courses.status, 'active'),
        inArray(courseSessions.status, ['upcoming', 'in_progress']),
      ),
    )
    .orderBy(asc(courseSessions.scheduledDate))
    .limit(limit);
}
export async function sessionsBetween(userId: string, start: Date, end: Date) {
  return db
    .select({ session: courseSessions, course: courses })
    .from(courseSessions)
    .innerJoin(courses, eq(courseSessions.courseId, courses.id))
    .where(
      and(
        eq(courses.ownerId, userId),
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
  if (canSeeProgress(user)) {
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
      .where(and(eq(exams.courseId, course.id), eq(examAttempts.userId, user.id)));
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
      title: course.title,
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      color: course.color,
      totalSessions: course.totalSessions,
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
