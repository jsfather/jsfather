import Link from 'next/link';
import { db } from '@/db';
import { exams, examQuestions, examAttempts } from '@/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';
import { PageTitle, Badge, Pagination } from '@/components/ui';
import { pageNumber } from '@/lib/data';
import { auth } from '@/lib/auth';
import { examScopeLabel, assessmentLabel } from '@/lib/exam-labels';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore public exams' };
export default async function ExploreExams({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; scope?: string }>;
}) {
  const query = await searchParams;
  const scope =
    query.scope === 'course' || query.scope === 'session' || query.scope === 'category'
      ? query.scope
      : 'all';
  const page = pageNumber(query.page);
  const list = await db
    .select({
      id: exams.id,
      title: exams.title,
      sessionId: exams.sessionId,
      categoryBankId: exams.categoryBankId,
      isFinal: exams.isFinal,
      isPractice: exams.isPractice,
      timeLimit: exams.timeLimit,
      passingScore: exams.passingScore,
      questionCount: sql<number>`(select count(*)::int from ${examQuestions} where exam_questions.exam_id = exams.id)`,
    })
    .from(exams)
    .where(
      and(
        eq(exams.isPublic, true),
        sql`exists (select 1 from ${examQuestions} where ${examQuestions.examId} = ${exams.id})`,
        scope === 'course'
          ? sql`${exams.courseId} is not null and ${exams.sessionId} is null`
          : scope === 'category'
            ? sql`${exams.categoryBankId} is not null`
            : scope === 'session'
              ? sql`${exams.sessionId} is not null`
              : undefined,
      ),
    )
    .orderBy(desc(exams.createdAt), desc(exams.id))
    .limit(20)
    .offset((page - 1) * 20);
  const session = await auth();
  const history = session?.user?.id
    ? await db
        .select({
          id: examAttempts.id,
          examId: exams.id,
          title: exams.title,
          percentage: examAttempts.percentage,
          submittedAt: examAttempts.submittedAt,
        })
        .from(examAttempts)
        .innerJoin(exams, eq(examAttempts.examId, exams.id))
        .where(eq(examAttempts.userId, session.user.id))
        .orderBy(desc(examAttempts.startedAt))
        .limit(10)
    : [];
  return (
    <>
      <PageTitle
        title="Explore public exams"
        description="Practice exams shared by the community. Sign in to save your results, or practice as a guest."
      />
      <nav className="actions-row" aria-label="Exam scope">
        {[
          ['all', 'All exams'],
          ['course', 'Course exams'],
          ['session', 'Session exams'],
          ['category', 'Category exams'],
        ].map(([value, label]) => (
          <Link
            key={value}
            className={'button ' + (scope === value ? 'primary' : 'secondary')}
            href={value === 'all' ? '/practice' : '/practice?scope=' + value}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="course-grid full">
        {list.map((exam) => (
          <article className="course-card" key={exam.id}>
            <Badge>{examScopeLabel(exam)}</Badge>
            <h3 style={{ marginTop: 16 }}>{exam.title}</h3>
            <p className="muted">
              {assessmentLabel(exam)} · {exam.questionCount} questions
            </p>
            <p className="muted">
              {exam.timeLimit} minutes · Pass at {exam.passingScore}%
            </p>
            <Link className="button secondary" href={'/practice/' + exam.id}>
              Practice exam
            </Link>
          </article>
        ))}
      </div>
      {!list.length && <p className="muted">No public exams here yet.</p>}
      <Pagination
        page={page}
        hasMore={list.length === 20}
        base={scope === 'all' ? '/practice' : '/practice?scope=' + scope}
      />
      {!!history.length && (
        <section className="panel" style={{ marginTop: 24 }}>
          <h2>Your practice history</h2>
          {history.map((attempt) => (
            <div className="session-row" key={attempt.id}>
              <div className="session-info">
                <h4>{attempt.title}</h4>
                <span>{attempt.submittedAt ? `${attempt.percentage}%` : 'In progress'}</span>
              </div>
              <Link
                className="text-link"
                href={`/exams/${attempt.examId}/${attempt.submittedAt ? 'results' : 'take'}/${attempt.id}`}
              >
                {attempt.submittedAt ? 'View results' : 'Resume'}
              </Link>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
