import { describe, expect, it } from 'vitest';
import { assessmentDefaults, questionDefaults, type QuestionType } from '../src/lib/assessment';
import { scoreExam, type ScoringQuestion } from '../src/lib/learning';
import { questionSchema, classBankSchema } from '../src/lib/validation';
const options = [
  { id: 'a', text: 'Alpha', isCorrect: true },
  { id: 'b', text: 'Beta', isCorrect: false },
  { id: 'c', text: 'Gamma', isCorrect: true },
];
const question = (type: QuestionType, patch: Partial<ScoringQuestion> = {}): ScoringQuestion => ({
  id: 'q',
  question: 'A sample question',
  type,
  points: 3,
  explanation: '',
  options,
  ...patch,
});
const score = (q: ScoringQuestion, answer: string | string[]) => scoreExam([q], { q: answer }, 70);

describe('assessment settings', () => {
  it('calculates time from budgets and weights the suggested threshold by actual points', () => {
    const questions = (['easy', 'medium', 'hard'] as const).map((difficulty) => ({
      difficulty,
      ...questionDefaults[difficulty],
    }));
    expect(assessmentDefaults(questions)).toEqual({ timeLimit: 6, passingScore: 67 });
    expect(
      assessmentDefaults([
        { difficulty: 'hard', points: 10, timeSeconds: 5 },
        { difficulty: 'easy', points: 1, timeSeconds: 5 },
      ]),
    ).toEqual({ timeLimit: 1, passingScore: 62 });
  });
  it('allows a class bank without legacy exam metadata and allows explicit settings overrides', () => {
    const q = {
      question: 'Which one?',
      type: 'multiple_choice',
      difficulty: 'easy',
      points: 1,
      explanation: '',
      options: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    };
    expect(
      classBankSchema.safeParse({
        questions: [q],
        published: false,
        timeLimit: null,
        passingScore: null,
      }).success,
    ).toBe(true);
    expect(
      classBankSchema.safeParse({
        questions: [q],
        published: false,
        timeLimit: 12,
        passingScore: 85,
      }).success,
    ).toBe(true);
  });
});
describe('question grading', () => {
  it('grades single choice and true/false using the owned option key', () => {
    for (const type of ['multiple_choice', 'true_false'] as const) {
      const q = question(type, { options: options.slice(0, 2) });
      expect(score(q, 'a').passed).toBe(true);
      expect(score(q, 'foreign-id').score).toBe(0);
    }
  });
  it('requires exactly the multiple-answer key and rejects repeated or extra selections', () => {
    const q = question('multiple_select');
    expect(score(q, ['c', 'a']).score).toBe(3);
    for (const answer of [['a'], ['a', 'b', 'c'], ['a', 'a', 'c']])
      expect(score(q, answer).score).toBe(0);
  });
  it('normalizes typed answers and supports accepted alternatives and case sensitivity', () => {
    for (const type of ['short_answer', 'fill_blank'] as const) {
      const q = question(type, { acceptedAnswers: ['const value', 'let value'], options: [] });
      expect(score(q, '  CONST   value ').score).toBe(3);
      expect(score(q, 'let value').score).toBe(3);
      expect(score({ ...q, caseSensitive: true }, 'CONST value').score).toBe(0);
      expect(score(q, '').score).toBe(0);
    }
  });
  it('uses absolute numeric tolerance without treating empty or nonfinite answers as zero', () => {
    const q = question('numeric', { acceptedAnswers: ['0'], tolerance: 0.1, options: [] });
    expect(score(q, '0.1').score).toBe(3);
    for (const answer of ['', '0.11', 'Infinity', 'not a number'])
      expect(score(q, answer).score).toBe(0);
  });
  it('requires the full correct ordering, without duplicated or foreign items', () => {
    const q = question('ordering');
    expect(score(q, ['a', 'b', 'c']).score).toBe(3);
    for (const answer of [
      ['b', 'a', 'c'],
      ['a', 'a', 'c'],
      ['a', 'b'],
      ['a', 'b', 'foreign'],
    ])
      expect(score(q, answer).score).toBe(0);
  });
  it('requires all matching pairs and creates a readable review', () => {
    const q = question('matching', {
      options: [],
      pairs: [
        { left: 'A', right: '1' },
        { left: 'B', right: '2' },
      ],
    });
    const result = score(q, ['1', '2']);
    expect(result.score).toBe(3);
    expect(result.review[0].correct).toBe('A → 1; B → 2');
    expect(score(q, ['2', '1']).score).toBe(0);
    expect(score(q, ['1']).score).toBe(0);
  });
});
describe('question validation', () => {
  const base = {
    question: 'Sample question',
    difficulty: 'medium',
    points: 2,
    explanation: '',
    options: [],
  };
  it('rejects missing typed keys, nonnumeric keys, and ambiguous matching choices', () => {
    expect(questionSchema.safeParse({ ...base, type: 'short_answer' }).success).toBe(false);
    expect(
      questionSchema.safeParse({ ...base, type: 'numeric', acceptedAnswers: ['NaN'] }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({
        ...base,
        type: 'matching',
        pairs: [
          { left: 'A', right: '1' },
          { left: 'B', right: '1' },
        ],
      }).success,
    ).toBe(false);
  });
});
