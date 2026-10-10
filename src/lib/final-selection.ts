import { randomInt } from 'node:crypto';

type Candidate = { id: string; sessionId: string; difficulty: 'easy' | 'medium' | 'hard' };

// Round-robin classes; within each class prefer the least represented difficulty.
// Random tie-breaking prevents a fixed class or question from always being selected.
export function selectFinalQuestions<T extends Candidate>(pool: T[], limit = 30): T[] {
  const shuffle = <V>(items: V[]) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const sessions = shuffle([...new Set(pool.map((q) => q.sessionId))]);
  const remaining = shuffle(pool);
  const selected: T[] = [];
  const counts = { easy: 0, medium: 0, hard: 0 };
  while (remaining.length && selected.length < limit) {
    for (const sessionId of sessions) {
      const candidates = remaining.filter((q) => q.sessionId === sessionId);
      if (!candidates.length) continue;
      const minimum = Math.min(...candidates.map((q) => counts[q.difficulty]));
      const q = candidates.find((q) => counts[q.difficulty] === minimum)!;
      selected.push(q);
      counts[q.difficulty]++;
      remaining.splice(remaining.indexOf(q), 1);
      if (selected.length === limit) break;
    }
  }
  return shuffle(selected);
}
