export const defaultUniversityName = 'jsfather';
export function normalizeUniversityName(value: string) {
  const name = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return !name || name.toLowerCase() === defaultUniversityName ? defaultUniversityName : name;
}
