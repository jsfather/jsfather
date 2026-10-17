import 'server-only';
import { db } from '@/db';
import { courses, exams, examQuestions } from '@/db/schema';
import { and, or, eq } from 'drizzle-orm';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Only original question banks participate. Generated exams must never feed copies back in.
export function categoryQuestionPool(
  tx: Tx | typeof db,
  userId: string,
  bank: { id: string; category: string },
) {
  return tx
    .select({ question: examQuestions, courseId: courses.id })
    .from(examQuestions)
    .innerJoin(exams, eq(examQuestions.examId, exams.id))
    .leftJoin(courses, eq(exams.courseId, courses.id))
    .where(
      and(
        eq(exams.isFinal, false),
        eq(exams.isPractice, false),
        or(
          eq(exams.categoryBankId, bank.id),
          and(eq(courses.ownerId, userId), eq(courses.category, bank.category)),
        ),
      ),
    );
}
