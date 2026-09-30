import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { sessionsBetween } from '@/lib/data';
import { PageTitle, SessionRow, Empty } from '@/components/ui';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  format,
  parseISO,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
} from 'date-fns';
import { localDate } from '@/lib/validation';
export const metadata = { title: 'Timetable' };
export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const view = ['day', 'week', 'month'].includes(query.view ?? '') ? query.view! : 'week';
  const today = formatInTimeZone(new Date(), user.timezone, 'yyyy-MM-dd');
  const anchor = parseISO(localDate.safeParse(query.date).success ? query.date! : today);
  const start =
    view === 'month'
      ? startOfWeek(startOfMonth(anchor), { weekStartsOn: 6 })
      : view === 'week'
        ? startOfWeek(anchor, { weekStartsOn: 6 })
        : anchor;
  const end =
    view === 'month'
      ? addDays(startOfWeek(endOfMonth(anchor), { weekStartsOn: 6 }), 7)
      : addDays(start, view === 'week' ? 7 : 1);
  const days: Date[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  const sessions = await sessionsBetween(
    user.id,
    fromZonedTime(format(start, 'yyyy-MM-dd') + 'T00:00:00', user.timezone),
    fromZonedTime(format(end, 'yyyy-MM-dd') + 'T00:00:00', user.timezone),
  );
  const move = (dir: number) =>
    format(
      view === 'month' ? addMonths(anchor, dir) : addDays(anchor, dir * (view === 'week' ? 7 : 1)),
      'yyyy-MM-dd',
    );
  const dateStr = format(anchor, 'yyyy-MM-dd');
  const url = (v: string, d: string) => `/calendar?view=${v}&date=${d}`;
  return (
    <>
      <PageTitle
        eyebrow="MAKE ROOM FOR LEARNING"
        title="Your timetable"
        description={`Every class has its place. All times in ${user.timezone}.`}
      />
      <div className="calendar-controls">
        <div className="actions-row" style={{ margin: 0, alignItems: 'center' }}>
          <Link
            className="icon-button secondary"
            href={url(view, move(-1))}
            aria-label="Previous period"
          >
            <ChevronLeft size={18} />
          </Link>
          <h2>
            {view === 'day'
              ? format(anchor, 'EEEE, MMMM d')
              : view === 'month'
                ? format(anchor, 'MMMM yyyy')
                : `${format(start, 'MMM d')} – ${format(addDays(end, -1), 'MMM d, yyyy')}`}
          </h2>
          <Link
            className="icon-button secondary"
            href={url(view, move(1))}
            aria-label="Next period"
          >
            <ChevronRight size={18} />
          </Link>
          <Link
            className="button secondary"
            href={url(view, today)}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            Today
          </Link>
        </div>
        <div className="segmented">
          {['day', 'week', 'month'].map((v) => (
            <Link key={v} className={view === v ? 'active' : ''} href={url(v, dateStr)}>
              {v[0].toUpperCase() + v.slice(1)}
            </Link>
          ))}
        </div>
      </div>
      {view === 'day' ? (
        <section className="panel">
          {sessions.length ? (
            sessions.map((row) => (
              <SessionRow key={row.session.id} {...row} timezone={user.timezone} />
            ))
          ) : (
            <Empty
              title="No classes on this day."
              description="A clear schedule is a chance to review or plan your next course."
              href="/courses/new"
            />
          )}
        </section>
      ) : view === 'month' ? (
        <div className="timetable-scroll">
          <div className="calendar-grid">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              return (
                <div key={key} className={`calendar-day ${key === today ? 'is-today' : ''}`}>
                  <header>
                    <span>{format(day, 'EEE')}</span>
                    <strong>{format(day, 'd')}</strong>
                  </header>
                  {sessions
                    .filter(
                      (r) =>
                        formatInTimeZone(r.session.scheduledDate, user.timezone, 'yyyy-MM-dd') ===
                        key,
                    )
                    .map(({ session, course }) => (
                      <Link
                        key={session.id}
                        className={`calendar-event color-${course.color}`}
                        href={'/sessions/' + session.id}
                      >
                        <span>
                          {formatInTimeZone(session.scheduledDate, user.timezone, 'HH:mm')}
                        </span>
                        <strong>{course.title}</strong>
                        <small>Session {session.sessionNumber}</small>
                      </Link>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="timetable-scroll">
          <div className="timetable">
            <div className="timetable-head">TIME</div>
            {days.map((day) => (
              <div key={day.toISOString()} className="timetable-head">
                {format(day, 'EEE').toUpperCase()}
                <strong
                  style={{
                    color: format(day, 'yyyy-MM-dd') === today ? 'var(--accent)' : undefined,
                  }}
                >
                  {format(day, 'd')}
                </strong>
              </div>
            ))}
            {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
              <div key={hour} style={{ display: 'contents' }}>
                <div className="timetable-time">{String(hour).padStart(2, '0')}:00</div>
                {days.map((day) => (
                  <div key={day.toISOString()} className="timetable-slot">
                    {sessions
                      .filter(
                        (r) =>
                          formatInTimeZone(
                            r.session.scheduledDate,
                            user.timezone,
                            'yyyy-MM-dd-H',
                          ) ===
                          format(day, 'yyyy-MM-dd') + '-' + hour,
                      )
                      .map(({ session, course }) => (
                        <Link
                          key={session.id}
                          href={'/sessions/' + session.id}
                          className={`calendar-event color-${course.color}`}
                        >
                          <span>
                            {formatInTimeZone(session.scheduledDate, user.timezone, 'HH:mm')} ·{' '}
                            {session.duration} min
                          </span>
                          <strong>{course.title}</strong>
                          <small>
                            Session {session.sessionNumber}
                            {session.status === 'completed' ? ' · Completed' : ''}
                          </small>
                        </Link>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
