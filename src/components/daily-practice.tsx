import Link from 'next/link';
import { Flame, Clock, Sparkles } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { DAILY_GOAL_SECONDS, focusTime, focusXp } from '@/lib/practice';
import type { practiceSummary } from '@/lib/practice-data';
import { Progress } from './ui';
export function DailyPractice({
  summary,
  timezone,
}: {
  summary: Awaited<ReturnType<typeof practiceSummary>>;
  timezone: string;
}) {
  const { todaySeconds, current, best, metToday, today, days, totalSeconds } = summary;
  return (
    <section
      className={`panel daily-practice ${metToday ? 'goal-met' : ''}`}
      aria-label="Daily practice and streak"
    >
      <div className="section-header">
        <div>
          <p className="eyebrow">MAKE TIME FOR LEARNING</p>
          <h2>
            {metToday
              ? 'Today’s goal is complete'
              : current
                ? 'Keep your streak going'
                : 'Start your daily streak'}
          </h2>
        </div>
        <Link href="/activity" className="text-link">
          Practice history
        </Link>
      </div>
      <div className="daily-practice-stats">
        <div>
          <Flame size={20} aria-hidden="true" />
          <strong>{current}</strong>
          <span>day streak</span>
        </div>
        <div>
          <Clock size={20} aria-hidden="true" />
          <strong>{focusTime(todaySeconds)}</strong>
          <span>practiced today</span>
        </div>
        <div>
          <Sparkles size={20} aria-hidden="true" />
          <strong>{focusXp(totalSeconds)} XP</strong>
          <span>from {focusTime(totalSeconds)} of focus</span>
        </div>
      </div>
      <div className="progress-label">
        <span>
          {metToday
            ? 'Streak secured for today'
            : `${focusTime(Math.max(0, DAILY_GOAL_SECONDS - todaySeconds))} to reach today’s goal`}
        </span>
        <strong>{Math.min(100, Math.floor((todaySeconds / DAILY_GOAL_SECONDS) * 100))}%</strong>
      </div>
      <Progress value={Math.min(100, (todaySeconds / DAILY_GOAL_SECONDS) * 100)} />
      <div className="practice-week" aria-label="Practice over the last seven days">
        {Array.from({ length: 7 }, (_, index) => {
          const day = format(addDays(parseISO(today), index - 6), 'yyyy-MM-dd');
          const seconds = days.find((item) => item.day === day)?.seconds ?? 0;
          return (
            <div
              key={day}
              className={`${seconds >= DAILY_GOAL_SECONDS ? 'complete' : ''} ${day === today ? 'today' : ''}`}
            >
              <span>{day === today ? 'Today' : format(parseISO(day), 'EEE')}</span>
              <strong>{seconds >= DAILY_GOAL_SECONDS ? '✓' : '—'}</strong>
              <small>{focusTime(seconds)}</small>
            </div>
          );
        })}
      </div>
      <p className="field-hint">
        5 focus minutes per day keeps your streak. Every course counts. 1 focus minute = 1 XP. Best
        streak: {best} {best === 1 ? 'day' : 'days'}. Your day ends at midnight in {timezone}.
      </p>
      {!metToday && (
        <div className="actions-row">
          <Link href="/courses" className="button primary">
            Make time to practice
          </Link>
          <Link href="/settings" className="text-link">
            Set up practice reminders
          </Link>
        </div>
      )}
    </section>
  );
}
