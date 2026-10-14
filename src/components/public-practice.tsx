import { Flame, Sparkles, Clock, Trophy, Check } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { DAILY_GOAL_SECONDS, focusTime, focusXp } from '@/lib/practice';
import type { publicPracticeSummary } from '@/lib/practice-data';
export function PublicPractice({
  summary,
  completedCourses,
}: {
  summary: Awaited<ReturnType<typeof publicPracticeSummary>>;
  completedCourses: number;
}) {
  const milestones = [
    { title: 'First steps', detail: 'First focus minute', earned: summary.totalSeconds >= 60 },
    { title: 'Finding a rhythm', detail: '7-day best streak', earned: summary.best >= 7 },
    { title: 'An hour wiser', detail: '60 focus minutes', earned: summary.totalSeconds >= 3600 },
    { title: 'Finisher', detail: 'A course completed', earned: completedCourses > 0 },
  ];
  const days = new Map(summary.days.map((d) => [d.day, d.seconds]));
  return (
    <section className="panel ui-stack public-practice" aria-label="Shared learning activity">
      <div className="section-header">
        <div className="ui-stack">
          <p className="eyebrow">A LITTLE EVERY DAY</p>
          <h2>Building a learning habit</h2>
        </div>
        <span className="badge">
          {summary.metToday ? 'Today’s goal complete' : '5-minute daily goal'}
        </span>
      </div>
      <div className="public-focus-grid">
        <div>
          <Flame aria-hidden="true" />
          <strong>
            {summary.current}
            <small> days</small>
          </strong>
          <span>Current streak</span>
          <small>Personal best: {summary.best} days</small>
        </div>
        <div>
          <Sparkles aria-hidden="true" />
          <strong>
            {focusXp(summary.totalSeconds)}
            <small> XP</small>
          </strong>
          <span>Learning earned</span>
          <small>1 focus minute = 1 XP</small>
        </div>
        <div>
          <Clock aria-hidden="true" />
          <strong>{focusTime(summary.totalSeconds)}</strong>
          <span>Estimated focus time</span>
          <small>Across shared courses</small>
        </div>
      </div>
      <div className="ui-stack public-calendar-section">
        <div className="section-header">
          <h3>The last 28 days</h3>
          <span className="muted">{focusTime(summary.todaySeconds)} today</span>
        </div>
        <div
          className="public-activity-calendar"
          role="list"
          aria-label="Daily estimated learning time"
        >
          {Array.from({ length: 28 }, (_, i) => {
            const date = addDays(parseISO(summary.today), i - 27);
            const day = format(date, 'yyyy-MM-dd');
            const seconds = days.get(day) ?? 0;
            const label = `${format(date, 'EEEE, MMMM d')}: ${focusTime(seconds)}${seconds >= DAILY_GOAL_SECONDS ? ', daily goal complete' : ''}`;
            return (
              <div
                role="listitem"
                key={day}
                className={`activity-cell ${seconds >= DAILY_GOAL_SECONDS ? 'qualified' : seconds ? 'partial' : ''} ${day === summary.today ? 'today' : ''}`}
                aria-label={label}
                title={label}
              >
                <time dateTime={day}>{format(date, 'd')}</time>
                {seconds >= DAILY_GOAL_SECONDS && <Check size={13} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
        <div className="activity-legend">
          <span>
            <i />
            No practice
          </span>
          <span>
            <i className="partial" />
            Under 5 minutes
          </span>
          <span>
            <i className="qualified" />
            Goal complete
          </span>
        </div>
      </div>
      <div className="ui-stack public-milestones">
        <h3>
          <Trophy size={18} aria-hidden="true" />
          Milestones
        </h3>
        <div className="milestone-grid">
          {milestones.map((m) => (
            <div key={m.title} className={`milestone ${m.earned ? 'earned' : ''}`}>
              <span className="milestone-icon">
                {m.earned ? (
                  <Check size={18} aria-label="Earned" />
                ) : (
                  <Trophy size={18} aria-label="In progress" />
                )}
              </span>
              <div>
                <strong>{m.title}</strong>
                <p>{m.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="field-hint">
        Only activity in public courses appears here. Time is estimated from saved learning; earlier
        recorded practice is included.
      </p>
    </section>
  );
}
