import type { Exam } from '@/db/schema';
type ExamType = Pick<Exam, 'sessionId' | 'isFinal' | 'isPractice'>;
export function examScopeLabel(exam: Pick<Exam, 'sessionId'>) {
  return exam.sessionId ? 'Session exam' : 'Course exam';
}
export function assessmentLabel(exam: ExamType) {
  return exam.sessionId ? 'Session exam' : exam.isFinal ? 'Final assessment' : 'Course practice';
}
