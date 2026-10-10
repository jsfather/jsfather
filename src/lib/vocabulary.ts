export const reviewTargets = { easy: 5, medium: 10, hard: 15 } as const;
export type WordDifficulty = keyof typeof reviewTargets;

// Successful recalls are spaced progressively; harder words return more frequently.
// A failed recall never earns a repetition and returns after ten minutes.
export function nextVocabularyReview(
  difficulty: WordDifficulty,
  successfulReviews: number,
  remembered: boolean,
  now: Date,
) {
  if (!remembered) return new Date(now.getTime() + 10 * 60 * 1000);
  const baseDays = { easy: 2, medium: 1, hard: 0.5 }[difficulty];
  const days = Math.min(30, baseDays * 2 ** Math.min(6, Math.max(0, successfulReviews - 1)));
  return new Date(now.getTime() + days * 86400000);
}
