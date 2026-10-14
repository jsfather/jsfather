import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, courses, practiceSessions, practiceDays, examAttempts, exams } from '@/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { hasSameOrigin } from '@/lib/request-origin';
import { creditedPracticeSeconds, splitPracticeTime } from '@/lib/practice';
import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';

const inputSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('start'),
    courseId: z.string().min(1).max(100),
    activity: z.enum(['lesson', 'reading', 'vocabulary', 'exam']),
    attemptId: z.string().uuid().optional(),
  }),
  z.object({
    operation: z.literal('heartbeat'),
    sessionId: z.string().uuid(),
    sequence: z.number().int().min(1).max(2147483647),
    seconds: z.number().int().min(0).max(30),
    capturedAt: z.number().int().min(0).max(8640000000000000).optional(),
    finish: z.boolean().default(false),
  }),
]);
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function allowed(
  tx: Tx,
  userId: string,
  courseId: string,
  activity: string,
  attemptId?: string,
) {
  if (activity === 'exam') {
    const [row] = await tx
      .select({ id: examAttempts.id })
      .from(examAttempts)
      .innerJoin(exams, eq(exams.id, examAttempts.examId))
      .where(
        and(
          eq(examAttempts.userId, userId),
          eq(exams.courseId, courseId),
          isNull(examAttempts.submittedAt),
          attemptId ? eq(examAttempts.id, attemptId) : undefined,
          sql`${examAttempts.startedAt} + (coalesce((${examAttempts.snapshot}->>'timeLimit')::int, ${exams.timeLimit}) * interval '1 minute') >= now()`,
        ),
      )
      .limit(1);
    return !!row;
  }
  const [course] = await tx
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        eq(courses.status, 'active'),
        eq(
          courses.kind,
          activity === 'reading' ? 'book' : activity === 'vocabulary' ? 'vocabulary' : 'standard',
        ),
        activity === 'vocabulary'
          ? sql`(${courses.ownerId} = ${userId} or exists (select 1 from vocabulary_members m where m.course_id = ${courses.id} and m.user_id = ${userId}))`
          : eq(courses.ownerId, userId),
      ),
    )
    .limit(1);
  return !!course;
}
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return new Response(null, { status: 403 });
  const userId = (await auth())?.user?.id;
  if (!userId) return new Response(null, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const input = parsed.data;
  const result = await db.transaction(async (tx) => {
    // One lock order across timers prevents overlap and duplicate credit across tabs/devices.
    const [user] = await tx
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    if (!user) return { error: 'Sign in to record practice.', status: 401 };
    const now = new Date();
    if (input.operation === 'start') {
      if (input.activity === 'exam' && !input.attemptId)
        return { error: 'Choose an active exam attempt.', status: 400 };
      if (!(await allowed(tx, userId, input.courseId, input.activity, input.attemptId)))
        return { error: 'This practice is not available.', status: 403 };
      await tx
        .update(practiceSessions)
        .set({ endedAt: now })
        .where(and(eq(practiceSessions.userId, userId), isNull(practiceSessions.endedAt)));
      const [session] = await tx
        .insert(practiceSessions)
        .values({
          userId,
          courseId: input.courseId,
          activity: input.activity,
          attemptId: input.attemptId ?? null,
          startedAt: now,
          lastHeartbeatAt: now,
        })
        .returning({ id: practiceSessions.id });
      return { sessionId: session.id, startedAt: now.getTime() };
    }
    const [session] = await tx
      .select()
      .from(practiceSessions)
      .where(and(eq(practiceSessions.id, input.sessionId), eq(practiceSessions.userId, userId)))
      .for('update');
    if (!session) return { error: 'This timer is no longer available.', status: 404 };
    if (session.endedAt && !input.finish)
      return { error: 'Another timer has started. Resume here to switch back.', status: 409 };
    if (input.sequence > session.lastSequence) {
      // A final in-flight flush may credit only the time before another timer replaced it.
      let end = new Date(
        Math.max(
          session.lastHeartbeatAt.getTime(),
          Math.min(
            session.endedAt?.getTime() ?? now.getTime(),
            input.capturedAt ?? now.getTime(),
            now.getTime(),
          ),
        ),
      );
      let permitted =
        !!session.courseId && (await allowed(tx, userId, session.courseId!, session.activity));
      let examEnded = false;
      if (session.activity === 'exam' && session.attemptId && session.courseId) {
        const [attempt] = await tx
          .select({
            startedAt: examAttempts.startedAt,
            submittedAt: examAttempts.submittedAt,
            snapshot: examAttempts.snapshot,
            timeLimit: exams.timeLimit,
          })
          .from(examAttempts)
          .innerJoin(exams, eq(exams.id, examAttempts.examId))
          .where(
            and(
              eq(examAttempts.id, session.attemptId),
              eq(examAttempts.userId, userId),
              eq(exams.courseId, session.courseId),
            ),
          );
        permitted = !!attempt;
        if (attempt) {
          const cutoff = Math.min(
            attempt.submittedAt?.getTime() ?? Infinity,
            attempt.startedAt.getTime() +
              (attempt.snapshot?.timeLimit ?? attempt.timeLimit) * 60000,
          );
          end = new Date(Math.min(end.getTime(), cutoff));
          examEnded = now.getTime() >= cutoff;
        }
      }
      const seconds = permitted
        ? creditedPracticeSeconds(input.seconds, session.lastHeartbeatAt, end)
        : 0;
      for (const part of splitPracticeTime(end, seconds, user.timezone)) {
        await tx
          .insert(practiceDays)
          .values({ userId, ...part })
          .onConflictDoUpdate({
            target: [practiceDays.userId, practiceDays.day],
            set: { seconds: sql`${practiceDays.seconds} + ${part.seconds}` },
          });
      }
      await tx
        .update(practiceSessions)
        .set({
          seconds: session.seconds + seconds,
          lastSequence: input.sequence,
          lastHeartbeatAt: end,
          endedAt: session.endedAt ?? (input.finish || !permitted || examEnded ? end : null),
        })
        .where(eq(practiceSessions.id, session.id));
      session.seconds += seconds;
      session.endedAt = session.endedAt ?? (input.finish || !permitted || examEnded ? end : null);
    }
    if (input.finish && !session.endedAt) {
      await tx
        .update(practiceSessions)
        .set({ endedAt: now })
        .where(eq(practiceSessions.id, session.id));
      session.endedAt = now;
    }
    const day = formatInTimeZone(now, user.timezone, 'yyyy-MM-dd');
    const [today] = await tx
      .select({ seconds: practiceDays.seconds })
      .from(practiceDays)
      .where(and(eq(practiceDays.userId, userId), eq(practiceDays.day, day)));
    const [course] = await tx
      .select({ seconds: sql<number>`coalesce(sum(${practiceSessions.seconds}), 0)::int` })
      .from(practiceSessions)
      .where(
        and(
          eq(practiceSessions.userId, userId),
          session.courseId
            ? eq(practiceSessions.courseId, session.courseId)
            : isNull(practiceSessions.courseId),
        ),
      );
    return {
      sessionId: session.id,
      sessionSeconds: session.seconds,
      todaySeconds: today?.seconds ?? 0,
      courseSeconds: course.seconds,
      sequence: Math.max(input.sequence, session.lastSequence),
      ended: !!session.endedAt,
    };
  });
  if ('error' in result)
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { 'Cache-Control': 'no-store' } },
    );
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
