import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { ownedExam } from '@/lib/data';
import { db } from '@/db';
import { examQuestions, examOptions, examAttempts } from '@/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { PageTitle } from '@/components/ui';
import { ExamBuilder } from '@/components/exam-builder';
export const metadata = { title: 'Edit exam' };
export default async function EditExam({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { exam, course } = await ownedExam(user.id, (await params).id);
  const [attempt] = await db
    .select({ id: examAttempts.id })
    .from(examAttempts)
    .where(eq(examAttempts.examId, exam.id))
    .limit(1);
  if (attempt)
    return (
      <>
        <PageTitle
          title="This exam is locked"
          description="An attempt has already started. Create a new exam to change the assessment."
        />
        <Link className="button primary" href={'/exams/new?course=' + course.id}>
          Create another exam
        </Link>
      </>
    );
  const questions = await db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, exam.id))
    .orderBy(asc(examQuestions.order));
  const options = questions.length
    ? await db
        .select()
        .from(examOptions)
        .where(
          inArray(
            examOptions.questionId,
            questions.map((q) => q.id),
          ),
        )
        .orderBy(asc(examOptions.order))
    : [];
  return (
    <>
      <PageTitle eyebrow={course.title.toUpperCase()} title="Edit exam" />
      <ExamBuilder
        courseId={course.id}
        examId={exam.id}
        initial={{
          title: exam.title,
          description: exam.description,
          passingScore: exam.passingScore,
          timeLimit: exam.timeLimit,
          published: exam.published,
          questions: questions.map((q) => ({
            question: q.question,
            type: q.type,
            points: q.points,
            explanation: q.explanation,
            options: options
              .filter((o) => o.questionId === q.id)
              .map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          })),
        }}
      />
    </>
  );
}
