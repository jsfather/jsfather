import Link from 'next/link';
import { Pencil, Plus, CalendarDays, Clock, Globe, Lock } from 'lucide-react';
import { grade } from '@/lib/learning';
import { requireUser } from '@/lib/auth';
import { ownedCourse, pageNumber } from '@/lib/data';
import { db } from '@/db';
import { courseSessions, exams, examAttempts } from '@/db/schema';
import { eq, asc, sql, and, or, desc } from 'drizzle-orm';
import { PageTitle, Progress, SessionRow, Pagination } from '@/components/ui';
import { formatInTimeZone } from 'date-fns-tz';
import { AssessmentControls } from '@/components/final-controls';
import { assessmentLabel } from '@/lib/exam-labels';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  return { title: (await ownedCourse(user.id, (await params).id)).title };
}
export default async function CourseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const course = await ownedCourse(user.id, (await params).id);
  const page = pageNumber((await searchParams).page);
  const [sessions, counts, examList, next] = await Promise.all([
    db
      .select()
      .from(courseSessions)
      .where(eq(courseSessions.courseId, course.id))
      .orderBy(asc(courseSessions.sessionNumber))
      .limit(50)
      .offset((page - 1) * 50),
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter(where ${courseSessions.status}='completed')::int`,
      })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, course.id)),
    db
      .select({
        exam: exams,
        best: sql<number | null>`max(${examAttempts.percentage})`,
        passed: sql<boolean>`coalesce(bool_or(${examAttempts.passed}),false)`,
      })
      .from(exams)
      .leftJoin(
        examAttempts,
        and(eq(exams.id, examAttempts.examId), eq(examAttempts.userId, user.id)),
      )
      .where(
        and(eq(exams.courseId, course.id), or(eq(exams.isFinal, true), eq(exams.isPractice, true))),
      )
      .groupBy(exams.id)
      .orderBy(desc(exams.createdAt)),
    db
      .select()
      .from(courseSessions)
      .where(and(eq(courseSessions.courseId, course.id), eq(courseSessions.status, 'upcoming')))
      .orderBy(asc(courseSessions.scheduledDate))
      .limit(1),
  ]);
  const { total, completed } = counts[0];
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  const examScores = examList.flatMap((e) => (e.best === null || !e.exam.isFinal ? [] : [e.best]));
  const bestScore = examScores.length ? Math.max(...examScores) : null;
  return (
    <>
      <PageTitle
        eyebrow={course.category.toUpperCase()}
        title={course.title}
        action={
          <Link href={`/courses/${course.id}/edit`} className="button secondary">
            <Pencil size={15} />
            Edit course
          </Link>
        }
      />
      <div className="detail-layout">
        <div>
          <section className="panel detail-panel">
            <p className="detail-description">
              {course.description || 'Your learning journey starts one session at a time.'}
            </p>
            <div className="progress-label">
              <span>Course progress</span>
              <strong>{percentage}%</strong>
            </div>
            <Progress value={percentage} color={course.color} />
            <div className="detail-stats">
              <div>
                <strong>{completed}</strong>
                <span>Completed</span>
              </div>
              <div>
                <strong>{total - completed}</strong>
                <span>Remaining</span>
              </div>
              <div>
                <strong>{total}</strong>
                <span>Total sessions</span>
              </div>
            </div>
            <div className="section-header">
              <h2>Course sessions</h2>
              <Link className="button secondary" href={'/sessions/new?course=' + course.id}>
                <Plus size={16} />
                Add session
              </Link>
            </div>
            {!total && (
              <p className="muted">No sessions yet. Add a session to continue your course.</p>
            )}
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                course={course}
                timezone={course.timezone}
              />
            ))}
            <Pagination
              page={page}
              hasMore={sessions.length === 50}
              base={'/courses/' + course.id}
            />
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>Your schedule</h2>
            <div className="meta-list">
              <div>
                <span>Best exam score</span>
                <strong>{bestScore === null ? 'Not taken' : `${bestScore}%`}</strong>
              </div>
              <div>
                <span>Current grade</span>
                <strong>{bestScore === null ? '—' : grade(bestScore)}</strong>
              </div>
              <div>
                <span>
                  <CalendarDays size={13} /> Starts
                </span>
                <strong>{course.startDate}</strong>
              </div>
              <div>
                <span>
                  <Clock size={13} /> Class time
                </span>
                <strong>{course.scheduledTime}</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>{course.duration} minutes</strong>
              </div>
              <div>
                <span>Class days</span>
                <strong>
                  {course.weekdays
                    .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                    .join(', ')}
                </strong>
              </div>
              <div>
                <span>Timezone</span>
                <strong>{course.timezone}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{percentage === 100 ? 'Completed' : course.status}</strong>
              </div>
              <div>
                <span>Visibility</span>
                <strong>
                  {course.isPublic ? (
                    <>
                      <Globe size={12} /> Public
                    </>
                  ) : (
                    <>
                      <Lock size={12} /> Private
                    </>
                  )}
                </strong>
              </div>
            </div>
            {next[0] && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 22 }}>
                <div className="eyebrow">NEXT SESSION</div>
                <h3 style={{ fontSize: 15 }}>{next[0].title}</h3>
                <p className="muted" style={{ fontSize: 12, margin: '7px 0 15px' }}>
                  {formatInTimeZone(next[0].scheduledDate, course.timezone, 'EEEE, MMM d · HH:mm')}
                </p>
                <Link className="button primary" href={'/sessions/' + next[0].id}>
                  Open session
                </Link>
              </div>
            )}
          </section>
        </aside>
      </div>
      <AssessmentControls courseId={course.id}>
        {!!examList.length && (
          <div style={{ marginTop: 24 }}>
            <h3>Your assessment history</h3>
            {examList.slice(0, 20).map(({ exam, best, passed }) => (
              <div className="session-row" key={exam.id}>
                <div className="session-info">
                  <h4>{assessmentLabel(exam)}</h4>
                  <span>
                    {best === null
                      ? 'In progress'
                      : `Best: ${best}% · ${passed ? 'Passed' : 'Not passed'}`}
                  </span>
                </div>
                <Link className="text-link" href={'/exams/' + exam.id}>
                  Results & sharing
                </Link>
              </div>
            ))}
          </div>
        )}
      </AssessmentControls>
    </>
  );
}
