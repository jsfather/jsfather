import Link from 'next/link';
import { Check, SkipForward, RotateCcw } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { ownedSession } from '@/lib/data';
import { setSessionStatus } from '@/actions';
import { PageTitle, Badge } from '@/components/ui';
import { SessionForm, DeleteSessionForm, RemoveSessionExamForm } from '@/components/forms';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from '@/db';
import { exams } from '@/db/schema';
import { eq } from 'drizzle-orm';
export const metadata = { title: 'Study session' };
export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { session, course } = await ownedSession(user.id, (await params).id);
  const [exam] = await db.select().from(exams).where(eq(exams.sessionId, session.id)).limit(1);
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
      <SessionForm session={session} course={course} />
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="section-header">
          <h2>Session exam</h2>
        </div>
        {exam ? (
          <>
            <Link className="text-link" href={'/exams/' + exam.id}>
              {exam.title}
            </Link>
            <p className="muted" style={{ marginTop: 12 }}>
              {exam.timeLimit} minutes · Pass at {exam.passingScore}%
            </p>
            <div className="actions-row" style={{ marginTop: 20 }}>
              <Link className="button secondary" href={'/exams/' + exam.id + '/edit'}>
                Edit exam
              </Link>
              <RemoveSessionExamForm exam={exam} />
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 16 }}>
              No exam attached to this session.
            </p>
            <Link className="button primary" href={'/exams/new?session=' + session.id}>
              Add exam
            </Link>
          </>
        )}
      </section>
      <DeleteSessionForm session={session} />
    </>
  );
}
