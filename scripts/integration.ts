import { config } from 'dotenv';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { generateSchedule, scoreExam } from '../src/lib/learning';
config({ path: '.env.local' });
config();
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a test database.');
  if (process.env.NODE_ENV === 'production')
    throw new Error('Integration fixtures must not run against production.');
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  const userId = crypto.randomUUID();
  const courseId = crypto.randomUUID();
  try {
    const adapter = DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.authSessions,
      verificationTokensTable: schema.verificationTokens,
    });
    await db.insert(schema.users).values({
      id: userId,
      email: `integration-${userId}@example.test`,
      name: 'Integration Student',
    });
    const user = await adapter.getUser!(userId);
    assert.equal(user?.id, userId);
    const token = crypto.randomUUID();
    await adapter.createSession!({
      userId,
      sessionToken: token,
      expires: new Date(Date.now() + 3600000),
    });
    assert.equal((await adapter.getSessionAndUser!(token))?.user.id, userId);
    await adapter.deleteSession!(token);
    assert.equal(await adapter.getSessionAndUser!(token), null);
    console.log('PASS: Auth.js persistent sessions, lookup, and logout invalidation.');
    const input = {
      startDate: '2026-10-01',
      scheduledTime: '18:00',
      timezone: 'Asia/Tehran',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      totalSessions: 25,
    };
    await db.insert(schema.courses).values({
      ...input,
      id: courseId,
      ownerId: userId,
      title: 'Integration course',
      slug: 'integration',
      description: 'Test only',
      category: 'Web',
      difficulty: 'advanced',
      duration: 60,
    });
    await db.insert(schema.courseSessions).values(
      generateSchedule(input).map((date, i) => ({
        courseId,
        title: 'Session ' + (i + 1),
        sessionNumber: i + 1,
        scheduledDate: date,
        duration: 60,
      })),
    );
    let sessions = await db
      .select()
      .from(schema.courseSessions)
      .where(eq(schema.courseSessions.courseId, courseId));
    assert.equal(sessions.length, 25);
    await db
      .update(schema.courseSessions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(schema.courseSessions.id, sessions[0].id));
    sessions = await db
      .select()
      .from(schema.courseSessions)
      .where(eq(schema.courseSessions.courseId, courseId));
    assert.equal(sessions.filter((s) => s.status === 'completed').length, 1);
    console.log('PASS: Course CRUD, real generated sessions, and completion persistence.');
    const examId = crypto.randomUUID(),
      questionId = crypto.randomUUID(),
      optionId = crypto.randomUUID();
    await db
      .insert(schema.exams)
      .values({ id: examId, courseId, title: 'Integration exam', published: true });
    await db.insert(schema.examQuestions).values({
      id: questionId,
      examId,
      question: 'True?',
      type: 'true_false',
      points: 1,
      order: 0,
    });
    await db.insert(schema.examOptions).values([
      { id: optionId, questionId, text: 'True', isCorrect: true, order: 0 },
      { questionId, text: 'False', isCorrect: false, order: 1 },
    ]);
    const [attempt] = await db.insert(schema.examAttempts).values({ examId, userId }).returning();
    await assert.rejects(() => db.insert(schema.examAttempts).values({ examId, userId }));
    const result = scoreExam(
      [
        {
          id: questionId,
          question: 'True?',
          points: 1,
          explanation: 'Yes.',
          options: [{ id: optionId, text: 'True', isCorrect: true }],
        },
      ],
      { [questionId]: optionId },
      70,
    );
    await db.transaction(async (tx) => {
      await tx
        .update(schema.examAttempts)
        .set({ ...result, submittedAt: new Date() })
        .where(eq(schema.examAttempts.id, attempt.id));
      await tx.insert(schema.certificates).values({
        attemptId: attempt.id,
        userId,
        courseId,
        recipientName: 'Integration Student',
        courseTitle: 'Integration course',
        percentage: result.percentage,
      });
    });
    assert.equal(
      (await db.select().from(schema.certificates).where(eq(schema.certificates.userId, userId)))
        .length,
      1,
    );
    console.log(
      'PASS: One active attempt constraint, scoring, and transactional certificate creation.',
    );
    await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
    assert.equal(
      (
        await db
          .select()
          .from(schema.courseSessions)
          .where(eq(schema.courseSessions.courseId, courseId))
      ).length,
      0,
    );
    assert.equal(
      (await db.select().from(schema.certificates).where(eq(schema.certificates.userId, userId)))
        .length,
      0,
    );
    console.log('PASS: Foreign-key cascade cleanup.');
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    await client.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
