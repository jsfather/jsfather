import Link from 'next/link';
import { Award, CheckCircle2, BookOpen } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { ownedExam } from '@/lib/data';
import { db } from '@/db';
import { examAttempts, certificates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { PageTitle, Badge } from '@/components/ui';
export const metadata = { title: 'Exam results' };
export default async function ExamResults({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const user = await requireUser();
  const { id, attemptId } = await params;
  const { exam } = await ownedExam(user.id, id);
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.id, attemptId),
        eq(examAttempts.examId, id),
        eq(examAttempts.userId, user.id),
      ),
    );
  if (!attempt) notFound();
  if (!attempt.submittedAt) redirect(`/exams/${id}/take/${attemptId}`);
  const [certificate] = await db
    .select({ id: certificates.id })
    .from(certificates)
    .where(and(eq(certificates.attemptId, attemptId), eq(certificates.userId, user.id)));
  const correct = attempt.review?.filter((r) => r.isCorrect).length ?? 0;
  const elapsed = Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000);
  return (
    <>
      <PageTitle eyebrow="YOUR RESULTS" title={exam.title} />
      <section className="panel result-summary">
        {attempt.passed ? <Award size={42} /> : <BookOpen size={42} />}
        <h2>
          {attempt.passed
            ? 'A well-earned achievement.'
            : 'A little clarity for your next chapter.'}
        </h2>
        <div
          className="result-score"
          style={{ color: attempt.passed ? 'var(--accent)' : '#e8bd76' }}
        >
          {attempt.percentage}%
        </div>
        <Badge color={attempt.passed ? 'teal' : 'amber'}>
          {attempt.passed ? 'Passed' : 'Not passed'}
        </Badge>
        <p className="muted" style={{ marginTop: 20 }}>
          {attempt.score} / {attempt.maxScore} points · {correct} correct ·{' '}
          {(attempt.review?.length ?? 0) - correct} incorrect · {Math.floor(elapsed / 60)}m{' '}
          {elapsed % 60}s
        </p>
        <div className="actions-row">
          {certificate && (
            <Link className="button primary" href={'/certificates/' + certificate.id}>
              <Award size={16} />
              View certificate
            </Link>
          )}
          <Link className="button secondary" href={'/exams/' + id}>
            Back to exam
          </Link>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 25 }}>
        <h2>Review your answers</h2>
        {attempt.review?.map((r, i) => (
          <div className="review-row" key={r.questionId}>
            <Badge color={r.isCorrect ? 'teal' : 'rose'}>
              {r.isCorrect ? <CheckCircle2 size={12} /> : null}
              {r.isCorrect ? 'Correct' : 'Incorrect'} · {r.earned}/{r.points} points
            </Badge>
            <h3>
              {i + 1}. {r.question}
            </h3>
            <p>Your answer: {r.selected ?? 'Unanswered'}</p>
            {!r.isCorrect && <p style={{ color: 'var(--accent)' }}>Correct answer: {r.correct}</p>}
            {r.explanation && <p>{r.explanation}</p>}
          </div>
        ))}
      </section>
    </>
  );
}
