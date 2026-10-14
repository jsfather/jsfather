import { requireUser } from '@/lib/auth';
import { coursePracticeSeconds, practiceSummary } from '@/lib/practice-data';
import { focusTime, focusXp, type PracticeActivity } from '@/lib/practice';
import { Clock, Sparkles } from 'lucide-react';
const explanations: Record<PracticeActivity, string> = {
  reading:
    'Saving new reading progress adds 2 focus minutes per page. Previously credited pages count once.',
  vocabulary:
    'Each rated review adds 30 seconds of estimated practice, whether remembered or reviewed again.',
  lesson:
    'Completing a lesson adds its saved duration once. Reopening it or editing it does not award extra XP.',
  exam: 'Submitting this exam adds the time since it started, up to the exam’s time limit.',
};
export async function PracticePanel({
  courseId,
  activity,
}: {
  courseId: string;
  activity: PracticeActivity;
}) {
  const user = await requireUser();
  const [summary, seconds] = await Promise.all([
    practiceSummary(user.id, user.timezone),
    coursePracticeSeconds(user.id, courseId),
  ]);
  return (
    <section className="panel ui-stack practice-estimate" aria-label="Automatic practice estimates">
      <div className="section-header">
        <div>
          <p className="eyebrow">AUTOMATIC PRACTICE</p>
          <h2>Your learning adds up</h2>
        </div>
        <span className="badge">1 focus minute = 1 XP</span>
      </div>
      <div className="estimate-metrics">
        <span>
          <Clock size={18} aria-hidden="true" />
          <strong>{focusTime(seconds)}</strong> in this course
        </span>
        <span>
          <Sparkles size={18} aria-hidden="true" />
          <strong>{focusXp(seconds)} XP</strong> earned
        </span>
        <span>
          <strong>{focusTime(summary.todaySeconds)}</strong> today
        </span>
      </div>
      <p className="field-hint">
        {explanations[activity]} Time is estimated automatically from saved activity.
      </p>
    </section>
  );
}
