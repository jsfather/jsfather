import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { practiceSummary, practiceCourseTotals } from '@/lib/practice-data';
import { focusTime, focusXp, DAILY_GOAL_SECONDS } from '@/lib/practice';
import { PageTitle } from '@/components/ui';
import { DailyPractice } from '@/components/daily-practice';
export const metadata = { title: 'Practice history' };
export default async function Activity() {
  const user = await requireUser();
  const [summary, totals] = await Promise.all([
    practiceSummary(user.id, user.timezone),
    practiceCourseTotals(user.id),
  ]);
  return (
    <>
      <PageTitle
        title="Your time is your XP"
        description="A focus minute is 60 seconds of estimated practice. Every focus minute earns 1 XP, across every course type."
      />
      <DailyPractice summary={summary} timezone={user.timezone} />
      <section className="panel" style={{ marginBottom: 24 }}>
        <h2>Time by course</h2>
        {totals
          .filter((row) => row.seconds > 0)
          .map((row) => (
            <div className="practice-history-row" key={row.courseId ?? 'deleted'}>
              <span>
                {row.courseId && row.ownerId === user.id ? (
                  <Link className="text-link" href={'/courses/' + row.courseId}>
                    {row.title}
                  </Link>
                ) : (
                  (row.title ?? 'Deleted course')
                )}
              </span>
              <strong>
                {focusTime(row.seconds)} · {focusXp(row.seconds)} XP
              </strong>
            </div>
          ))}
        {!totals.some((row) => row.seconds > 0) && (
          <p className="muted">
            Complete a lesson, save reading progress, rate vocabulary, or submit an exam to earn
            your first focus minutes.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Daily time</h2>
        <p className="field-hint">
          Activity is credited to the day it is saved in your profile timezone. Days with less than
          5 minutes do not extend your streak.
        </p>
        {summary.days
          .slice()
          .reverse()
          .map((day) => (
            <div className="practice-history-row" key={day.day}>
              <time dateTime={day.day}>{day.day}</time>
              <span>
                {focusTime(day.seconds)} · {focusXp(day.seconds)} XP
              </span>
              <span>
                {day.seconds >= DAILY_GOAL_SECONDS ? 'Goal complete' : 'Below daily goal'}
              </span>
            </div>
          ))}
        {!summary.days.length && (
          <p className="muted">
            Your practice history starts with your first saved learning activity.
          </p>
        )}
      </section>
    </>
  );
}
