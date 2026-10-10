import { expect, it } from 'vitest';
import { assessmentName } from '../src/lib/assessment-names';
it('names course and session assessments without truncating their names', () => {
  expect(assessmentName('Keyvan', 'final')).toBe('Keyvan final assessment');
  expect(assessmentName('Keyvan', 'practice')).toBe('Keyvan practice assessment');
  expect(assessmentName('Keyvan', 'practice', 'Session 1')).toBe(
    'Keyvan Session 1 practice assessment',
  );
  expect(assessmentName('a'.repeat(160), 'practice', 'b'.repeat(160))).toHaveLength(341);
});
