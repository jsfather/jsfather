import 'server-only';
import { randomInt } from 'node:crypto';
import type { QuestionType } from './assessment';
export type SafeQuestion = {
  id: string;
  question: string;
  points: number;
  type: QuestionType;
  timeSeconds: number;
  prompts: string[];
  options: { id: string; text: string }[];
};
function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
export function safeQuestion(q: {
  id: string;
  question: string;
  points: number;
  type: QuestionType;
  timeSeconds: number;
  pairs: { left: string; right: string }[];
  options: { id: string; text: string }[];
}): SafeQuestion {
  return {
    id: q.id,
    question: q.question,
    points: q.points,
    type: q.type,
    timeSeconds: q.timeSeconds,
    prompts: q.type === 'matching' ? q.pairs.map((p) => p.left) : [],
    options:
      q.type === 'matching'
        ? shuffle(q.pairs.map((p) => ({ id: crypto.randomUUID(), text: p.right })))
        : shuffle(q.options.map((o) => ({ id: o.id, text: o.text }))),
  };
}
