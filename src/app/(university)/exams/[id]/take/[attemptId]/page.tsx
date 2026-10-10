import { requireUser } from '@/lib/auth';
import { accessibleExam } from '@/lib/data';
import { db } from '@/db';
import { examQuestions, examOptions, examAttempts } from '@/db/schema';
import { eq, asc, inArray, and } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { ExamRunner } from '@/components/exam-runner';
import { examScopeLabel, assessmentLabel } from '@/lib/exam-labels';
import { safeQuestion } from '@/lib/safe-questions';
export const metadata = { title: 'Take exam' };
export default async function TakeExam({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const user = await requireUser();
  const { id, attemptId } = await params;
  const { exam } = await accessibleExam(user.id, id, true);
  const [attempt] = await db
    .select({
      id: examAttempts.id,
      submittedAt: examAttempts.submittedAt,
      startedAt: examAttempts.startedAt,
      snapshot: examAttempts.snapshot,
    })
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.id, attemptId),
        eq(examAttempts.examId, id),
        eq(examAttempts.userId, user.id),
      ),
    );
  if (!attempt) notFound();
  if (attempt.submittedAt) redirect(`/exams/${id}/results/${attemptId}`);
  // Project snapshots explicitly; never serialize the key or explanations to the runner.
  const questions = await db
    .select({
      id: examQuestions.id,
      question: examQuestions.question,
      points: examQuestions.points,
      type: examQuestions.type,
      timeSeconds: examQuestions.timeSeconds,
      pairs: examQuestions.pairs,
    })
    .from(examQuestions)
    .where(eq(examQuestions.examId, id))
    .orderBy(asc(examQuestions.order));
  const options = questions.length
    ? await db
        .select({ id: examOptions.id, questionId: examOptions.questionId, text: examOptions.text })
        .from(examOptions)
        .where(
          inArray(
            examOptions.questionId,
            questions.map((q) => q.id),
          ),
        )
        .orderBy(asc(examOptions.order))
    : [];
  const expiresAt =
    attempt.startedAt.getTime() + (attempt.snapshot?.timeLimit ?? exam.timeLimit) * 60000;
  return (
    <>
      <PageTitle
        eyebrow={`${examScopeLabel(exam)} · ${assessmentLabel(exam)}`.toUpperCase()}
        title={exam.title}
        description="Take your time. Trust what you’ve learned."
      />
      <ExamRunner
        attemptId={attemptId}
        expiresAt={expiresAt}
        initialSeconds={Math.max(0, Math.ceil((expiresAt - new Date().getTime()) / 1000))}
        questions={
          attempt.snapshot
            ? attempt.snapshot.questions.map(safeQuestion)
            : questions.map((q) =>
                safeQuestion({
                  ...q,
                  options: options
                    .filter((o) => o.questionId === q.id)
                    .map((o) => ({ id: o.id, text: o.text })),
                }),
              )
        }
      />
    </>
  );
}
