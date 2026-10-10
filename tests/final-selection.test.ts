import { describe, expect, it } from 'vitest';
import { selectFinalQuestions } from '../src/lib/final-selection';

const pool = (classes: number, perLevel: number) =>
  Array.from({ length: classes }, (_, c) =>
    (['easy', 'medium', 'hard'] as const).flatMap((difficulty) =>
      Array.from({ length: perLevel }, (_, i) => ({
        id: `${c}-${difficulty}-${i}`,
        sessionId: String(c),
        difficulty,
      })),
    ),
  ).flat();

describe('course final selection', () => {
  it('covers every class and balances levels when enough questions are available', () => {
    const selected = selectFinalQuestions(pool(5, 10));
    expect(selected).toHaveLength(30);
    expect(new Set(selected.map((q) => q.id)).size).toBe(30);
    for (let c = 0; c < 5; c++)
      expect(selected.filter((q) => q.sessionId === String(c))).toHaveLength(6);
    for (const difficulty of ['easy', 'medium', 'hard'])
      expect(selected.filter((q) => q.difficulty === difficulty)).toHaveLength(10);
  });
  it('uses the available questions when a difficulty or class is scarce', () => {
    const candidates = pool(3, 2).filter((q) => q.difficulty !== 'hard');
    const selected = selectFinalQuestions(candidates);
    expect(selected).toHaveLength(candidates.length);
    expect(new Set(selected.map((q) => q.id)).size).toBe(candidates.length);
  });
  it('includes every class for courses longer than the default final length', () => {
    const selected = selectFinalQuestions(pool(40, 2), 40);
    expect(selected).toHaveLength(40);
    expect(new Set(selected.map((q) => q.sessionId)).size).toBe(40);
  });
  it('changes its random sample while retaining balance', () => {
    const candidates = pool(5, 10);
    const samples = Array.from({ length: 5 }, () =>
      selectFinalQuestions(candidates)
        .map((q) => q.id)
        .sort()
        .join(','),
    );
    expect(new Set(samples).size).toBeGreaterThan(1);
  });
});
