export function assessmentName(course: string, mode: 'final' | 'practice', session?: string) {
  return `${course}${session ? ` ${session}` : ''} ${mode} assessment`;
}
