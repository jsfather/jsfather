import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { CourseInput } from './validation';
export function generateSchedule(
  input: Pick<
    CourseInput,
    'startDate' | 'scheduledTime' | 'timezone' | 'weekdays' | 'totalSessions'
  >,
) {
  if (!input.weekdays.length || input.totalSessions < 1 || input.totalSessions > 1000)
    throw new Error('Invalid schedule configuration.');
  const dates: Date[] = [];
  let day = parseISO(input.startDate);
  while (dates.length < input.totalSessions) {
    if (input.weekdays.includes(day.getDay())) {
      const local = format(day, 'yyyy-MM-dd') + 'T' + input.scheduledTime + ':00';
      const instant = fromZonedTime(local, input.timezone);
      if (formatInTimeZone(instant, input.timezone, "yyyy-MM-dd'T'HH:mm:ss") !== local)
        throw new Error('A class time falls in a daylight saving gap. Choose another time.');
      dates.push(instant);
    }
    day = addDays(day, 1);
  }
  return dates;
}
export function progress(sessions: { status: string }[]) {
  const completed = sessions.filter((s) => s.status === 'completed').length;
  return {
    completed,
    total: sessions.length,
    remaining: sessions.length - completed,
    percentage: sessions.length ? Math.round((completed / sessions.length) * 100) : 0,
  };
}
export function grade(percentage: number) {
  return percentage >= 90
    ? 'A'
    : percentage >= 80
      ? 'B'
      : percentage >= 70
        ? 'C'
        : percentage >= 60
          ? 'D'
          : 'F';
}
export type ScoringQuestion = {
  id: string;
  question: string;
  points: number;
  explanation: string;
  options: { id: string; text: string; isCorrect: boolean }[];
};
export function scoreExam(
  questions: ScoringQuestion[],
  answers: Record<string, string>,
  passingScore: number,
) {
  const review = questions.map((q) => {
    const correct = q.options.find((o) => o.isCorrect);
    if (!correct) throw new Error('Invalid exam answer key.');
    const selected = q.options.find((o) => o.id === answers[q.id]);
    const isCorrect = selected?.id === correct.id;
    return {
      questionId: q.id,
      question: q.question,
      selected: selected?.text ?? null,
      correct: correct.text,
      isCorrect,
      points: q.points,
      earned: isCorrect ? q.points : 0,
      explanation: q.explanation,
    };
  });
  const score = review.reduce((sum, r) => sum + r.earned, 0),
    maxScore = questions.reduce((sum, q) => sum + q.points, 0);
  const exact = maxScore ? (score / maxScore) * 100 : 0;
  return {
    score,
    maxScore,
    percentage: Math.round(exact * 100) / 100,
    passed: exact >= passingScore,
    review,
  };
}
export function canSeeCourse(
  profile: { publicProfile: boolean; showCourses: boolean },
  course: { isPublic: boolean },
) {
  return profile.publicProfile && profile.showCourses && course.isPublic;
}
export function canSeeProgress(profile: { publicProfile: boolean; publicProgress: boolean }) {
  return profile.publicProfile && profile.publicProgress;
}
export function canSeeScores(profile: {
  publicProfile: boolean;
  publicProgress: boolean;
  showExamScores: boolean;
}) {
  return canSeeProgress(profile) && profile.showExamScores;
}
export function ownsResource(userId: string, ownerId: string) {
  return userId === ownerId;
}
export const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'course';
