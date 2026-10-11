// The course's local calendar day determines one shared batch. Progress never
// changes this selection, so invited collaborators see exactly the owner's words.
export function dailyVocabulary<T extends { id: string; word: string; awlSublist: number | null }>(
  words: T[],
  day: string,
  startDate: string,
  count = 10,
): T[] {
  if (!words.length) return [];
  const ordered = [...words].sort(
    (a, b) =>
      (a.awlSublist ?? 11) - (b.awlSublist ?? 11) ||
      a.word.localeCompare(b.word, 'en') ||
      a.id.localeCompare(b.id),
  );
  const elapsed = Math.max(
    0,
    Math.floor((Date.parse(day + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000),
  );
  const offset = (elapsed * count) % ordered.length;
  return Array.from(
    { length: Math.min(count, ordered.length) },
    (_, i) => ordered[(offset + i) % ordered.length],
  );
}
