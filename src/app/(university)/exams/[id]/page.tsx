import Link from 'next/link';
import { Pencil, Play, Lock, ClipboardList } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { ownedExam, pageNumber } from '@/lib/data';
import { db } from '@/db';
import { examAttempts, examQuestions, courseSessions } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { startAttempt } from '@/actions';
import { PageTitle, Badge, Pagination } from '@/components/ui';
import { Submit, DeleteExamForm } from '@/components/forms';
import { formatInTimeZone } from 'date-fns-tz';
import { PublicExamControl, AssignExamClass } from '@/components/final-controls';
export const metadata = { title: 'Exam details' };
export default async function ExamDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { exam, course } = await ownedExam(user.id, (await params).id);
  const page = pageNumber((await searchParams).page);
  const [attempts, questions, lock] = await Promise.all([
    db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, exam.id), eq(examAttempts.userId, user.id)))
      .orderBy(desc(examAttempts.startedAt))
      .limit(20)
      .offset((page - 1) * 20),
    db
      .select({
        count: sql<number>`count(*)::int`,
        points: sql<number>`sum(${examQuestions.points})::int`,
      })
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id)),
    db
      .select({ id: examAttempts.id })
      .from(examAttempts)
      .where(eq(examAttempts.examId, exam.id))
      .limit(1),
  ]);
  const hasAttempts = lock.length > 0;
  const classStatuses = exam.isFinal
    ? await db
        .select({ status: courseSessions.status })
        .from(courseSessions)
        .where(eq(courseSessions.courseId, course.id))
    : [];
  const canTake =
    !exam.isFinal ||
    (classStatuses.length > 0 && classStatuses.every((s) => s.status === 'completed'));
  const sessions =
    !exam.isFinal && !exam.sessionId
      ? await db
          .select({ id: courseSessions.id, title: courseSessions.title })
          .from(courseSessions)
          .where(eq(courseSessions.courseId, course.id))
      : [];
  return (
    <>
      {!exam.isFinal && !exam.sessionId && <AssignExamClass id={exam.id} sessions={sessions} />}
      <Link className="text-link" href={'/courses/' + course.id} style={{ marginBottom: 22 }}>
        {course.title}
      </Link>
      <PageTitle
        eyebrow={exam.isFinal ? 'COURSE FINAL' : 'CLASS QUESTION BANK'}
        title={exam.title}
        action={
          !hasAttempts && !exam.isFinal ? (
            <Link href={`/exams/${exam.id}/edit`} className="button secondary">
              <Pencil size={15} />
              Edit exam
            </Link>
          ) : (
            <Badge>
              <Lock size={12} />
              Questions locked
            </Badge>
          )
        }
      />
      <div className="detail-layout">
        <section className="panel">
          <p className="detail-description">
            {exam.description || 'Take a focused moment to put your knowledge to the test.'}
          </p>
          <div className="detail-stats">
            <div>
              <strong>{questions[0].count}</strong>
              <span>Questions</span>
            </div>
            <div>
              <strong>{exam.timeLimit} min</strong>
              <span>Time limit</span>
            </div>
            <div>
              <strong>{exam.passingScore}%</strong>
              <span>Passing score</span>
            </div>
          </div>
          {canTake ? (
            <form action={startAttempt.bind(null, exam.id)}>
              <Submit>
                <Play size={16} />
                {attempts.some((a) => !a.submittedAt) ? 'Resume attempt' : 'Start exam'}
              </Submit>
            </form>
          ) : (
            <div className="alert">
              <p className="muted">
                Complete every class before starting or resuming the course final.
              </p>
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>
            The timer starts immediately. Correct answers and explanations appear after submission.
            You can take multiple attempts.
          </p>
        </section>
        <section className="panel">
          <ClipboardList size={24} style={{ color: 'var(--accent)', marginBottom: 17 }} />
          <h3>A checkpoint, not a finish line.</h3>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.8, marginTop: 12 }}>
            {exam.isFinal
              ? 'Pass this final after completing every class to earn your course certificate.'
              : 'Practice your class questions. Only the course final awards a certificate.'}
          </p>
          <div className="meta-list">
            <div>
              <span>Total points</span>
              <strong>{questions[0].points}</strong>
            </div>
            <div>
              <span>Status</span>
              <Badge color={exam.isPublic ? 'teal' : 'neutral'}>
                {exam.isFinal ? 'Final assessment' : exam.isPublic ? 'Public' : 'Private'}
              </Badge>
            </div>
          </div>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Public practice</h2>
        <p className="muted" style={{ margin: '12px 0' }}>
          Guests can take this assessment without signing in. Their results are not stored.
        </p>
        <PublicExamControl id={exam.id} published={exam.isPublic} />
        {exam.isPublic && (
          <Link className="text-link" style={{ marginTop: 16 }} href={'/practice/' + exam.id}>
            Open public exam link
          </Link>
        )}
      </section>
      <section className="panel" style={{ marginTop: 26 }}>
        <div className="section-header">
          <h2>Your attempts</h2>
        </div>
        {attempts.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td>{formatInTimeZone(a.startedAt, user.timezone, 'MMM d, yyyy · HH:mm')}</td>
                      <td>{a.submittedAt ? `${a.score}/${a.maxScore} · ${a.percentage}%` : '—'}</td>
                      <td>
                        <Badge color={a.passed ? 'teal' : 'neutral'}>
                          {!a.submittedAt ? 'In progress' : a.passed ? 'Passed' : 'Not passed'}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={
                            a.submittedAt
                              ? `/exams/${exam.id}/results/${a.id}`
                              : `/exams/${exam.id}/take/${a.id}`
                          }
                        >
                          {a.submittedAt ? 'View results' : 'Resume'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} hasMore={attempts.length === 20} base={'/exams/' + exam.id} />
          </>
        ) : (
          <p className="muted">You haven’t taken this exam yet.</p>
        )}
      </section>
      <section style={{ marginTop: 26 }}>
        <DeleteExamForm exam={exam} />
      </section>
    </>
  );
}
