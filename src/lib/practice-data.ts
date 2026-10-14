import 'server-only';
import { db } from '@/db';
import { practiceDays, practiceSessions, courses, users } from '@/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { formatInTimeZone } from 'date-fns-tz';
import { streakSummary } from './practice';
export async function practiceSummary(userId: string, timezone: string, now = new Date()) {
  const days = await db
    .select({ day: practiceDays.day, seconds: practiceDays.seconds })
    .from(practiceDays)
    .where(eq(practiceDays.userId, userId))
    .orderBy(asc(practiceDays.day));
  const today = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  return { ...streakSummary(days, today), days, today };
}
export async function coursePracticeSeconds(userId: string, courseId: string) {
  const [row] = await db
    .select({ seconds: sql<number>`coalesce(sum(${practiceSessions.seconds}), 0)::int` })
    .from(practiceSessions)
    .where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.courseId, courseId)));
  return row.seconds;
}
export async function practiceCourseTotals(userId: string) {
  return db
    .select({
      courseId: practiceSessions.courseId,
      title: courses.title,
      ownerId: courses.ownerId,
      seconds: sql<number>`sum(${practiceSessions.seconds})::int`,
    })
    .from(practiceSessions)
    .leftJoin(courses, eq(courses.id, practiceSessions.courseId))
    .where(eq(practiceSessions.userId, userId))
    .groupBy(practiceSessions.courseId, courses.title, courses.ownerId)
    .orderBy(desc(sql`sum(${practiceSessions.seconds})`));
}

// Public totals must never use practice_days: it includes private courses.
export async function publicPracticeSummary(userId: string, now = new Date()) {
  const [user] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId));
  const day = sql<string>`coalesce(${practiceSessions.day}, to_char(${practiceSessions.startedAt} at time zone ${user.timezone}, 'YYYY-MM-DD'))`;
  const days = await db
    .select({ day, seconds: sql<number>`sum(${practiceSessions.seconds})::int` })
    .from(practiceSessions)
    .innerJoin(courses, eq(courses.id, practiceSessions.courseId))
    .where(and(eq(practiceSessions.userId, userId), eq(courses.isPublic, true)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const today = formatInTimeZone(now, user.timezone, 'yyyy-MM-dd');
  return { ...streakSummary(days, today), days, today };
}
