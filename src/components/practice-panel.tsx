import { requireUser } from '@/lib/auth';
import { coursePracticeSeconds, practiceSummary } from '@/lib/practice-data';
import type { PracticeActivity } from '@/lib/practice';
import { PracticeTimer } from './practice-timer';
export async function PracticePanel({
  courseId,
  activity,
  automatic = false,
  attemptId,
}: {
  courseId: string;
  activity: PracticeActivity;
  automatic?: boolean;
  attemptId?: string;
}) {
  const user = await requireUser();
  const [summary, courseSeconds] = await Promise.all([
    practiceSummary(user.id, user.timezone),
    coursePracticeSeconds(user.id, courseId),
  ]);
  return (
    <PracticeTimer
      key={courseId + ':' + activity}
      courseId={courseId}
      activity={activity}
      automatic={automatic}
      attemptId={attemptId}
      initialTodaySeconds={summary.todaySeconds}
      initialCourseSeconds={courseSeconds}
    />
  );
}
