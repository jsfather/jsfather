import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { generateSchedule } from '../src/lib/learning';
config({ path: '.env.local' });
config();
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development seed must not run in production.');
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  try {
    const email = process.env.SEED_EMAIL ?? 'keyvan@example.test';
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    const userId = existing?.id ?? crypto.randomUUID();
    const [already] = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.ownerId, userId))
      .limit(1);
    if (already) {
      console.log('Seed already exists; no records changed.');
      return;
    }
    await db.transaction(async (tx) => {
      if (!existing)
        await tx.insert(schema.users).values({
          id: userId,
          name: 'Keyvan Matinrad',
          email,
          username: 'keyvan',
          bio: 'Building a personal university. One class at a time.',
        });
      const courseId = crypto.randomUUID();
      const input = {
        startDate: '2026-10-01',
        scheduledTime: '18:00',
        timezone: 'Asia/Tehran',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        totalSessions: 25,
      };
      await tx.insert(schema.courses).values({
        ...input,
        id: courseId,
        ownerId: userId,
        title: 'Advanced JavaScript',
        slug: 'advanced-javascript',
        description:
          'Understand the language behind the web. From closures and prototypes to asynchronous patterns and performance.',
        category: 'Frontend Engineering',
        difficulty: 'advanced',
        color: 'amber',
        duration: 60,
        isPublic: false,
      });
      await tx.insert(schema.courseSessions).values(
        generateSchedule(input).map((date, i) => ({
          courseId,
          title: `Session ${i + 1}`,
          sessionNumber: i + 1,
          scheduledDate: date,
          duration: 60,
        })),
      );
      const examId = crypto.randomUUID();
      await tx.insert(schema.exams).values({
        id: examId,
        courseId,
        title: 'Advanced JavaScript Final Exam',
        description: 'A checkpoint for your JavaScript foundations.',
        passingScore: 70,
        timeLimit: 30,
        published: true,
      });
      for (const [order, item] of [
        {
          question: 'Which declaration is block scoped?',
          answers: ['var', 'let', 'Both are function scoped', 'Neither'],
          correct: 1,
          explanation: 'let is block scoped; var is function scoped.',
        },
        {
          question: 'A closure can retain access to its lexical environment.',
          answers: ['True', 'False'],
          correct: 0,
          explanation: 'Closures keep references to their lexical environment.',
        },
      ].entries()) {
        const questionId = crypto.randomUUID();
        await tx.insert(schema.examQuestions).values({
          id: questionId,
          examId,
          question: item.question,
          type: item.answers.length === 2 ? 'true_false' : 'multiple_choice',
          points: 1,
          order,
          explanation: item.explanation,
        });
        await tx.insert(schema.examOptions).values(
          item.answers.map((text, i) => ({
            questionId,
            text,
            isCorrect: i === item.correct,
            order: i,
          })),
        );
      }
    });
    console.log(
      `Seed created for ${email}. To access it, set SEED_EMAIL to your Google email before seeding. No development login bypass exists.`,
    );
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
