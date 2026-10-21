import { SessionNotes } from '@/components/session-notes';
import { sessionNotes } from '@/lib/session-notes';
import { StudyMarkdown } from '@/components/study-markdown';
import { SessionReviewForm } from '@/components/lesson-learning-forms';
import { PracticePanel } from '@/components/practice-panel';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, SkipForward, RotateCcw } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { ownedSession } from '@/lib/data';
import { setSessionStatus, startAttempt } from '@/actions';
import { PageTitle, Badge } from '@/components/ui';
import { SessionForm, DeleteSessionForm, DeleteExamForm, Submit } from '@/components/forms';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from '@/db';
import { exams, courseChapters, sessionReviews } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
export const metadata = { title: 'Study session' };
export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { session, course } = await ownedSession(user.id, (await params).id);
  if (course.kind === 'book') redirect('/courses/' + course.id);
  const [exam] = await db.select().from(exams).where(eq(exams.sessionId, session.id)).limit(1);
  const [chapters, reviews, notes] = await Promise.all([
    db
      .select()
      .from(courseChapters)
      .where(eq(courseChapters.courseId, course.id))
      .orderBy(asc(courseChapters.position)),
    db
      .select()
      .from(sessionReviews)
      .where(eq(sessionReviews.sessionId, session.id))
      .orderBy(desc(sessionReviews.createdAt))
      .limit(20),
    sessionNotes({ userId: user.id, courseId: course.id, sessionId: session.id }, session.notes),
  ]);
  const chapter = chapters.find((item) => item.id === session.chapterId);
  const confidenceLabels = {
    revisit: 'Need to revisit',
    developing: 'Still developing',
    confident: 'Can explain independently',
  };
  return (
    <>
      <Link className="text-link" href={'/courses/' + course.id} style={{ marginBottom: 22 }}>
        {course.title}
      </Link>
      <PageTitle
        eyebrow={`SESSION ${String(session.sessionNumber).padStart(2, '0')}`}
        title={session.title}
        description={
          formatInTimeZone(session.scheduledDate, course.timezone, 'EEEE, MMMM d · HH:mm') +
          ` · ${session.duration} minutes · ${course.timezone}`
        }
        action={
          <Badge color={session.status === 'completed' ? 'teal' : 'neutral'}>
            {session.status.replace('_', ' ')}
          </Badge>
        }
      />
      <PracticePanel courseId={course.id} activity="lesson" />
      <div className="actions-row">
        {session.status !== 'completed' && (
          <form action={setSessionStatus.bind(null, session.id, 'completed')}>
            <button className="button primary">
              <Check size={17} />
              Mark as completed
            </button>
          </form>
        )}
        {session.status !== 'skipped' && (
          <form action={setSessionStatus.bind(null, session.id, 'skipped')}>
            <button className="button secondary">
              <SkipForward size={16} />
              Skip session
            </button>
          </form>
        )}
        {['completed', 'skipped'].includes(session.status) && (
          <form action={setSessionStatus.bind(null, session.id, 'upcoming')}>
            <button className="button secondary">
              <RotateCcw size={15} />
              Reopen session
            </button>
          </form>
        )}
      </div>
      <div className="ui-stack section-stack lesson-sections">
        {chapter && (
          <Link className="text-link" href={`/courses/${course.id}?chapter=${chapter.id}`}>
            Chapter: {chapter.title}
          </Link>
        )}
        <section className="panel ui-stack" aria-label="Review this lesson">
          <h2>Review this lesson</h2>
          <p className="muted">
            Before reading your notes, recall what you learned from this video.
          </p>
          <SessionReviewForm sessionId={session.id} />
          <details className="lesson-reveal">
            <summary>Reveal study notes &amp; previous reviews</summary>
            <div className="ui-stack">
              <h3>Study notes</h3>
              {!notes.length && (
                <p className="muted">No study notes yet. Add a Markdown note below.</p>
              )}
              {notes.map((note) => (
                <article className="ui-stack recalled-note" key={note.path}>
                  <p className="note-file-path">{note.path}</p>
                  <StudyMarkdown>{note.body}</StudyMarkdown>
                </article>
              ))}
              <h3>Review history</h3>
              {!reviews.length && (
                <p className="muted">No reviews yet. Save your first recall above.</p>
              )}
              {reviews.map((review) => (
                <article className="ui-stack lesson-review" key={review.id}>
                  <h4>
                    {formatInTimeZone(review.createdAt, course.timezone, 'MMM d, yyyy · HH:mm')} ·{' '}
                    {confidenceLabels[review.confidence]}
                  </h4>
                  <p className="lesson-text">{review.keyPoints}</p>
                  {review.questions && (
                    <div className="ui-stack">
                      <h4>Open questions</h4>
                      <p className="lesson-text">{review.questions}</p>
                    </div>
                  )}
                </article>
              ))}
              {reviews.length === 20 && (
                <p className="field-hint">Showing your latest 20 reviews.</p>
              )}
            </div>
          </details>
        </section>
        <SessionNotes sessionId={session.id} notes={notes} />
        <SessionForm session={session} course={course} chapters={chapters} />
      </div>
      <section className="panel ui-stack lesson-assessment">
        <h2>Assessment</h2>
        {exam ? (
          <>
            <p className="muted">
              Practice with all questions from this session. Your result is saved.
            </p>
            <div className="panel-actions">
              <form action={startAttempt.bind(null, exam.id, true)}>
                <Submit>Practice</Submit>
              </form>
            </div>
            <Link className="text-link" href={'/exams/' + exam.id + '/edit'}>
              Add or edit practice questions
            </Link>
            <h3>{exam.title}</h3>
            <p className="muted">
              {exam.timeLimit} minutes · Pass at {exam.passingScore}%
            </p>
            <Link className="text-link" href={'/exams/' + exam.id}>
              Results, sharing &amp; edit exam
            </Link>
          </>
        ) : (
          <>
            <p className="muted">No exam attached to this session.</p>
            <Link className="button primary" href={'/exams/new?session=' + session.id}>
              Add exam
            </Link>
          </>
        )}
      </section>
      <div className="destructive-actions">
        {exam && <DeleteExamForm exam={exam} returnToSession />}
        <DeleteSessionForm session={session} />
      </div>
    </>
  );
}
