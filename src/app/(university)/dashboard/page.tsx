import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { courseSummaries, universityStats, upcomingSessions, sessionsBetween } from '@/lib/data';
import { PageTitle, CourseCard, SessionRow, Empty } from '@/components/ui';
import {
  Plus,
  BookOpen,
  CheckCheck,
  Clock,
  Award,
  CalendarDays,
  ArrowUpRight,
  GraduationCap,
} from 'lucide-react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays, format, parseISO } from 'date-fns';
export const metadata = { title: 'Overview' };
export default async function Dashboard() {
  const user = await requireUser();
  const now = new Date();
  const day = formatInTimeZone(now, user.timezone, 'yyyy-MM-dd');
  const start = fromZonedTime(day + 'T00:00:00', user.timezone);
  const end = fromZonedTime(
    format(addDays(parseISO(day), 1), 'yyyy-MM-dd') + 'T00:00:00',
    user.timezone,
  );
  const [stats, current, today, upcoming] = await Promise.all([
    universityStats(user.id),
    courseSummaries(user.id, 1, false, true),
    sessionsBetween(user.id, start, end),
    upcomingSessions(user.id, 5),
  ]);
  const firstName = user.name?.split(' ')[0] ?? user.username;
  return (
    <>
      <PageTitle
        eyebrow="YOUR PERSONAL CAMPUS"
        title={`Welcome back, ${firstName}.`}
        description="A little focus today. A little further tomorrow."
        action={
          <Link href="/courses/new" className="button primary">
            <Plus size={17} />
            Create course
          </Link>
        }
      />
      <div className="stats-grid">
        {[
          {
            label: 'Courses enrolled',
            value: stats.courses,
            unit: 'courses',
            note: `${stats.completedCourses} fully completed`,
            icon: BookOpen,
          },
          {
            label: 'Sessions completed',
            value: stats.completed,
            unit: `/ ${stats.total}`,
            note: 'Every session is a step forward',
            icon: CheckCheck,
          },
          {
            label: 'Time invested',
            value: Math.round((stats.minutes / 60) * 10) / 10,
            unit: 'hours',
            note: 'Built one class at a time',
            icon: Clock,
          },
          {
            label: 'Exams passed',
            value: stats.passedExams,
            unit: 'exams',
            note: 'Put your knowledge to the test',
            icon: Award,
          },
        ].map(({ label, value, unit, note, icon: Icon }) => (
          <article key={label} className="stat-card">
            <div className="stat-label">
              {label}
              <Icon size={16} />
            </div>
            <div className="stat-value">
              <strong>{value}</strong>
              <span>{unit}</span>
            </div>
            <div className="stat-foot">{note}</div>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <div>
          <section className="panel today-panel">
            <div className="section-header">
              <h2>
                <CalendarDays size={18} className="muted" />
                Today’s classes <span className="count">{today.length}</span>
              </h2>
              <span className="today-date">
                {formatInTimeZone(now, user.timezone, 'EEE, MMM d')}
              </span>
            </div>
            {today.length ? (
              today.map((row) => (
                <SessionRow key={row.session.id} {...row} timezone={user.timezone} />
              ))
            ) : (
              <div className="empty compact">
                <h3>A little room to learn.</h3>
                <p className="muted">
                  No classes scheduled today. Review a course or plan your next chapter.
                </p>
                <Link className="text-link" href="/calendar">
                  View your timetable <ArrowUpRight size={14} />
                </Link>
              </div>
            )}
          </section>
          <section>
            <div className="section-header">
              <h2>
                Your courses <span className="count">{stats.courses}</span>
              </h2>
              <Link href="/courses" className="text-link">
                View all courses <ArrowUpRight size={14} />
              </Link>
            </div>
            {current.length ? (
              <div className="course-grid">
                {current.slice(0, 6).map((row) => (
                  <CourseCard key={row.course.id} {...row} timezone={user.timezone} />
                ))}
              </div>
            ) : (
              <Empty
                title="Your university starts with one course."
                description="Choose something you want to learn. We’ll help you turn it into a schedule you can follow."
                href="/courses/new"
              />
            )}
          </section>
        </div>
        <aside className="side-column">
          <section className="panel progress-panel">
            <h2>University progress</h2>
            <div className="progress-ring">
              <svg viewBox="0 0 160 160" aria-hidden="true">
                <circle className="ring-bg" cx="80" cy="80" r="67" />
                <circle
                  className="ring-value"
                  cx="80"
                  cy="80"
                  r="67"
                  strokeDasharray="421"
                  strokeDashoffset={421 * (1 - stats.percentage / 100)}
                />
              </svg>
              <div className="ring-center">
                <strong>
                  {stats.percentage}
                  <span style={{ fontSize: 20, color: 'var(--text)' }}>%</span>
                </strong>
                <span>overall completion</span>
              </div>
            </div>
            <p className="progress-caption">
              {stats.completed} of {stats.total} sessions completed
            </p>
            <div className="mini-stats">
              <div>
                <strong>{stats.completedCourses}</strong>
                <span>Courses completed</span>
              </div>
              <div>
                <strong>{stats.passedExams}</strong>
                <span>Exams passed</span>
              </div>
            </div>
          </section>
          <section className="panel upcoming-panel">
            <div className="section-header">
              <h2>Up next</h2>
              <Clock size={16} className="muted" />
            </div>
            {upcoming.length ? (
              upcoming.map(({ session, course }) => (
                <Link className="upcoming-item" key={session.id} href={'/sessions/' + session.id}>
                  <div className="upcoming-day">
                    <small>{formatInTimeZone(session.scheduledDate, user.timezone, 'EEE')}</small>
                    <strong>{formatInTimeZone(session.scheduledDate, user.timezone, 'd')}</strong>
                  </div>
                  <div>
                    <h4>{course.title}</h4>
                    <p>
                      {formatInTimeZone(session.scheduledDate, user.timezone, 'HH:mm')} · Session{' '}
                      {session.sessionNumber}
                    </p>
                    {session.scheduledDate < now && (
                      <span style={{ color: '#e8bd76', fontSize: 10 }}>
                        Overdue · ready when you are
                      </span>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>
                Your next classes will appear here.
              </p>
            )}
            <Link href="/calendar" className="text-link">
              Open timetable <ArrowUpRight size={14} />
            </Link>
          </section>
          <section className="note-card">
            <GraduationCap size={24} />
            <h3>Small steps. Real progress.</h3>
            <p>You don’t have to learn everything today. Just show up for your next session.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
