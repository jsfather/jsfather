import type { Exam } from '@/db/schema';
type ExamType = Pick<Exam, 'sessionId' | 'isFinal' | 'isPractice'> & {
  categoryBankId?: string | null;
};
export function examScopeLabel(exam: Pick<Exam, 'sessionId'> & { categoryBankId?: string | null }) {
  return exam.categoryBankId ? 'Category exam' : exam.sessionId ? 'Session exam' : 'Course exam';
}
export function assessmentLabel(exam: ExamType) {
  return exam.categoryBankId
    ? exam.isFinal
      ? 'Category exam'
      : 'Category questions'
    : exam.sessionId
      ? 'Session exam'
      : exam.isFinal
        ? 'Final assessment'
        : 'Course practice';
}
