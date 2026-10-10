import { db } from '@/db';
import { exams, examQuestions, examOptions } from '@/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { PageTitle, Badge } from '@/components/ui';
import { ExamRunner } from '@/components/exam-runner';
import { sealGuestExam } from '@/lib/guest-exam';
import { submitGuestExam, startAttempt } from '@/actions';
import { safeQuestion } from '@/lib/safe-questions';
import { auth } from '@/lib/auth';
import { Submit } from '@/components/forms';
import Link from 'next/link';
import { examScopeLabel, assessmentLabel } from '@/lib/exam-labels';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Public practice', robots: { index: false } };

export default async function PublicExam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
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
      <Link className="text-link" href="/practice">
        Explore exams
      </Link>
      <div className="actions-row">
        <Badge>{examScopeLabel(exam)}</Badge>
        <Badge>{assessmentLabel(exam)}</Badge>
      </div>
      <PageTitle
        eyebrow="PUBLIC PRACTICE"
        title={exam.title}
        description={
          session?.user?.id
            ? 'Practice this exam and save your result to your account. Public practice does not award a course certificate.'
            : 'Practice as a guest without saving, or sign in to keep your result.'
        }
      />
      {session?.user?.id ? (
        <section className="panel">
          <p className="muted" style={{ marginBottom: 20 }}>
            {questions.length} questions · {exam.timeLimit} minutes · Pass at {exam.passingScore}%
          </p>
          <form action={startAttempt.bind(null, id, true)}>
            <Submit>Start practice</Submit>
          </form>
        </section>
      ) : (
        <>
          <Link className="text-link" href="/login" style={{ marginBottom: 20 }}>
            Sign in to save your result
          </Link>
          <ExamRunner
            attemptId={crypto.randomUUID()}
            questions={full.map(safeQuestion)}
            expiresAt={expiresAt}
            initialSeconds={exam.timeLimit * 60}
            submitAction={submitGuestExam.bind(null, token)}
          />
        </>
      )}
    </>
  );
}
