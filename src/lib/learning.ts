import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { CourseInput } from './validation';
import { isTypedQuestion, type Answers, type QuestionType } from './assessment';
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
  type?: QuestionType;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  tolerance?: number;
  pairs?: { left: string; right: string }[];
  options: { id: string; text: string; isCorrect: boolean }[];
};
export function scoreExam(questions: ScoringQuestion[], answers: Answers, passingScore: number) {
  const review = questions.map((q) => {
    const type = q.type ?? 'multiple_choice';
    const answer = answers[q.id];
    let selected: string | null = null;
    let correct = '';
    let isCorrect = false;
    if (isTypedQuestion(type)) {
      const accepted = q.acceptedAnswers ?? [];
      if (!accepted.length) throw new Error('Invalid typed answer key.');
      selected = typeof answer === 'string' && answer.trim() ? answer : null;
      correct = accepted.join(' / ');
      const normalize = (text: string) => {
        const normalized = text.normalize('NFKC').trim().replace(/\s+/g, ' ');
        return q.caseSensitive ? normalized : normalized.toLocaleLowerCase('en');
      };
      isCorrect =
        selected !== null &&
        (type === 'numeric'
          ? Number.isFinite(Number(selected)) &&
            Math.abs(Number(selected) - Number(accepted[0])) <=
              (q.tolerance ?? 0) + Number.EPSILON * Math.max(1, Math.abs(Number(accepted[0])))
          : accepted.some((text) => normalize(text) === normalize(selected!)));
    } else if (type === 'matching') {
      const pairs = q.pairs ?? [];
      if (!pairs.length) throw new Error('Invalid matching key.');
      correct = pairs.map((p) => `${p.left} → ${p.right}`).join('; ');
      selected = Array.isArray(answer)
        ? pairs.map((p, i) => `${p.left} → ${answer[i] || '—'}`).join('; ')
        : null;
      isCorrect =
        Array.isArray(answer) &&
        answer.length === pairs.length &&
        pairs.every((p, i) => answer[i] === p.right);
    } else if (type === 'ordering' || type === 'multiple_select') {
      const key = type === 'ordering' ? q.options : q.options.filter((o) => o.isCorrect);
      if (!key.length) throw new Error('Invalid answer key.');
      correct = key.map((o) => o.text).join(type === 'ordering' ? ' → ' : '; ');
      selected =
        Array.isArray(answer) && answer.length
          ? answer
              .map((id) => q.options.find((o) => o.id === id)?.text ?? 'Invalid option')
              .join(type === 'ordering' ? ' → ' : '; ')
          : null;
      isCorrect =
        Array.isArray(answer) &&
        new Set(answer).size === answer.length &&
        answer.length === key.length &&
        (type === 'ordering'
          ? key.every((o, i) => answer[i] === o.id)
          : key.every((o) => answer.includes(o.id)));
    } else {
      const key = q.options.find((o) => o.isCorrect);
      if (!key) throw new Error('Invalid exam answer key.');
      const option = q.options.find((o) => o.id === answer);
      selected = option?.text ?? null;
      correct = key.text;
      isCorrect = option?.id === key.id;
    }
    return {
      questionId: q.id,
      question: q.question,
      selected,
      correct,
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
