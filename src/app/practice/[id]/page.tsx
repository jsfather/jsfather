import { db } from '@/db';
import { exams, examQuestions, examOptions } from '@/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { ExamRunner } from '@/components/exam-runner';
import { sealGuestExam } from '@/lib/guest-exam';
import { submitGuestExam } from '@/actions';
import { safeQuestion } from '@/lib/safe-questions';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Public practice', robots: { index: false } };

export default async function PublicExam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [exam] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.id, id), eq(exams.isPublic, true)));
  if (!exam) notFound();
  const questions = await db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, id))
    .orderBy(asc(examQuestions.order));
  if (!questions.length) notFound();
  const options = await db
    .select()
    .from(examOptions)
    .where(
      inArray(
        examOptions.questionId,
        questions.map((q) => q.id),
      ),
    )
    .orderBy(asc(examOptions.order));
  const full = questions.map((q) => ({
    ...q,
    options: options.filter((o) => o.questionId === q.id),
  }));
  const expiresAt = new Date().getTime() + exam.timeLimit * 60000;
  const token = sealGuestExam({
    examId: id,
    expiresAt,
    passingScore: exam.passingScore,
    questions: full,
  });
  return (
    <>
      <PageTitle
        eyebrow="PUBLIC PRACTICE"
        title={exam.title}
        description="Test your knowledge without an account. Your score is shown here and is never recorded."
      />
      <ExamRunner
        attemptId={crypto.randomUUID()}
        questions={full.map(safeQuestion)}
        expiresAt={expiresAt}
        initialSeconds={exam.timeLimit * 60}
        submitAction={submitGuestExam.bind(null, token)}
      />
    </>
  );
}
