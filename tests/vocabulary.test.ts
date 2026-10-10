import { describe, expect, it } from 'vitest';
import { nextVocabularyReview, reviewTargets } from '../src/lib/vocabulary';
const now = new Date('2026-10-11T10:00:00Z');
describe('Vocabulary review scheduling', () => {
  it('uses the requested mastery targets', () => {
    expect(reviewTargets).toEqual({ easy: 5, medium: 10, hard: 15 });
  });
  it('spaces recalled words progressively and returns harder words sooner', () => {
    expect(nextVocabularyReview('easy', 1, true, now)).toEqual(new Date('2026-10-13T10:00:00Z'));
    expect(nextVocabularyReview('medium', 1, true, now)).toEqual(new Date('2026-10-12T10:00:00Z'));
    expect(nextVocabularyReview('hard', 1, true, now)).toEqual(new Date('2026-10-11T22:00:00Z'));
    expect(nextVocabularyReview('medium', 3, true, now)).toEqual(new Date('2026-10-15T10:00:00Z'));
  });
  it('returns forgotten words after ten minutes, regardless of previous progress', () => {
    expect(nextVocabularyReview('hard', 14, false, now)).toEqual(new Date('2026-10-11T10:10:00Z'));
  });
  it('caps spacing at thirty days', () => {
    expect(nextVocabularyReview('hard', 14, true, now)).toEqual(new Date('2026-11-10T10:00:00Z'));
  });
});
