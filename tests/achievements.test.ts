import { achievementDetails, achievementRequirementProgress } from '../src/lib/achievement-details';
import { expect, it } from 'vitest';
import { achievementsFor, emptyAchievementStats } from '../src/lib/achievements';
it('starts with no earned achievements and meaningful targets', () => {
  const list = achievementsFor(emptyAchievementStats);
  expect(list).toHaveLength(22);
  expect(list.every((a) => !a.earned && a.progress === 0 && a.target > 0)).toBe(true);
});
it('earns focus milestones at whole minute boundaries and caps progress', () => {
  const badge = (seconds: number) =>
    achievementsFor({ ...emptyAchievementStats, focusSeconds: seconds }).find(
      (a) => a.id === 'first-steps',
    )!;
  expect(badge(59).earned).toBe(false);
  expect(badge(60)).toMatchObject({ earned: true, progress: 1, target: 1, percentage: 100 });
  expect(badge(120).progress).toBe(1);
});
it('uses best streaks, so an expired current streak does not erase a milestone', () => {
  expect(
    achievementsFor({ ...emptyAchievementStats, bestStreak: 30 })
      .filter((a) => a.metric === 'bestStreak')
      .every((a) => a.earned),
  ).toBe(true);
});
it('keeps course and category certificates independent and hides all assessment criteria when scores are hidden', () => {
  const stats = {
    ...emptyAchievementStats,
    categoryCertificates: 1,
    examsCompleted: 1,
    perfectExams: 1,
  };
  const list = achievementsFor(stats);
  expect(list.find((a) => a.id === 'category-certified')?.earned).toBe(true);
  expect(list.find((a) => a.id === 'course-certified')?.earned).toBe(false);
  expect(achievementsFor(stats, false).some((a) => a.group === 'Assessments')).toBe(false);
});
it('requires actual completions and mastery thresholds, with incomplete progress visible', () => {
  const list = achievementsFor({
    ...emptyAchievementStats,
    masteredWords: 9,
    completedBooks: 2,
    examsPassed: 4,
  });
  expect(list.find((a) => a.id === 'ten-words')).toMatchObject({
    earned: false,
    progress: 9,
    target: 10,
  });
  expect(list.find((a) => a.id === 'first-book')?.earned).toBe(true);
  expect(list.find((a) => a.id === 'three-books')).toMatchObject({ earned: false, progress: 2 });
  expect(list.find((a) => a.id === 'five-exams')?.earned).toBe(false);
});

it('provides specific earning and counting details for every badge', () => {
  for (const achievement of achievementsFor(emptyAchievementStats)) {
    const detail = achievementDetails[achievement.id];
    expect(detail.meaning.length).toBeGreaterThan(30);
    expect(detail.requirement.length).toBeGreaterThan(20);
    expect(detail.counting.length).toBeGreaterThan(40);
  }
});
it('formats singular requirements without implying uncapped public totals', () => {
  const badge = achievementsFor({ ...emptyAchievementStats, focusSeconds: 1000 }).find(
    (a) => a.id === 'first-steps',
  )!;
  expect(achievementRequirementProgress(badge)).toBe('1 / 1 minute');
});
