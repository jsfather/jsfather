import { expect, it } from 'vitest';
import { dailyVocabulary } from '../src/lib/daily-vocabulary';
import awl from '../src/data/academic-word-list.json';
const words = awl.map((word, i) => ({ ...word, id: String(i), awlSublist: word.sublist }));
it('includes every source family and a Persian meaning, preserving related forms', () => {
  expect(words).toHaveLength(570);
  expect(new Set(words.map((w) => w.word)).size).toBe(570);
  expect(words.every((w) => /[\u0600-\u06ff]/.test(w.persianMeaning))).toBe(true);
  expect(
    words.every(
      (w) => w.pronunciationIpa.startsWith('/') && /[\u0600-\u06ff]/.test(w.pronunciationFa),
    ),
  ).toBe(true);
  expect(words.reduce((sum, w) => sum + w.relatedForms.length, 0)).toBe(2539);
  for (let n = 1; n <= 10; n++)
    expect(words.filter((w) => w.sublist === n)).toHaveLength(n === 10 ? 30 : 60);
});
it('selects the same daily batch regardless of database row order or learner progress', () => {
  expect(dailyVocabulary(words, '2026-10-11', '2026-10-11')).toEqual(
    dailyVocabulary([...words].reverse(), '2026-10-11', '2026-10-11'),
  );
  expect(dailyVocabulary(words, '2026-10-12', '2026-10-11')).not.toEqual(
    dailyVocabulary(words, '2026-10-11', '2026-10-11'),
  );
});
it('covers every word exactly once during a 57-day cycle, then repeats', () => {
  const ids = Array.from({ length: 57 }, (_, i) =>
    dailyVocabulary(
      words,
      new Date(Date.UTC(2026, 9, 11 + i)).toISOString().slice(0, 10),
      '2026-10-11',
    ),
  )
    .flat()
    .map((w) => w.id);
  expect(new Set(ids).size).toBe(570);
  expect(dailyVocabulary(words, '2026-12-07', '2026-10-11')).toEqual(
    dailyVocabulary(words, '2026-10-11', '2026-10-11'),
  );
});
it('handles empty and small courses without duplicates', () => {
  expect(dailyVocabulary([], '2026-10-11', '2026-10-11')).toEqual([]);
  expect(dailyVocabulary(words.slice(0, 3), '2026-10-11', '2026-10-11')).toHaveLength(3);
});
