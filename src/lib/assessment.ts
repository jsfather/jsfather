export const questionTypes = [
  'multiple_choice',
  'multiple_select',
  'true_false',
  'short_answer',
  'fill_blank',
  'numeric',
  'ordering',
  'matching',
] as const;
export type QuestionType = (typeof questionTypes)[number];
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Answers = Record<string, string | string[]>;
export type SnapshotQuestion = {
  id: string;
  question: string;
  type: QuestionType;
  points: number;
  explanation: string;
  timeSeconds: number;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  tolerance: number;
  pairs: { left: string; right: string }[];
  options: { id: string; text: string; isCorrect: boolean }[];
};
export type AttemptSnapshot = {
  questions: SnapshotQuestion[];
  timeLimit: number;
  passingScore: number;
};
export const questionDefaults: Record<
  Difficulty,
  { points: number; timeSeconds: number; mastery: number }
> = {
  easy: { points: 1, timeSeconds: 60, mastery: 80 },
  medium: { points: 2, timeSeconds: 90, mastery: 70 },
  hard: { points: 3, timeSeconds: 180, mastery: 60 },
};
export const isTypedQuestion = (type: string) =>
  ['short_answer', 'fill_blank', 'numeric'].includes(type);
export function assessmentDefaults(
  questions: { points: number; difficulty: Difficulty; timeSeconds: number }[],
) {
  const points = questions.reduce((sum, q) => sum + q.points, 0);
  return {
    timeLimit: Math.max(1, Math.ceil(questions.reduce((sum, q) => sum + q.timeSeconds, 0) / 60)),
    // A transparent personal-study heuristic, not a validated psychometric cut score.
    passingScore: points
      ? Math.round(
          questions.reduce((sum, q) => sum + q.points * questionDefaults[q.difficulty].mastery, 0) /
            points,
        )
      : 70,
  };
}
