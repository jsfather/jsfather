export type AchievementStats = {
  focusSeconds: number;
  bestStreak: number;
  lessons: number;
  completedCourses: number;
  pagesRead: number;
  completedBooks: number;
  vocabularyReviews: number;
  masteredWords: number;
  examsCompleted: number;
  examsPassed: number;
  perfectExams: number;
  courseCertificates: number;
  categoryCertificates: number;
  questionsWritten: number;
};
export const emptyAchievementStats: AchievementStats = {
  focusSeconds: 0,
  bestStreak: 0,
  lessons: 0,
  completedCourses: 0,
  pagesRead: 0,
  completedBooks: 0,
  vocabularyReviews: 0,
  masteredWords: 0,
  examsCompleted: 0,
  examsPassed: 0,
  perfectExams: 0,
  courseCertificates: 0,
  categoryCertificates: 0,
  questionsWritten: 0,
};
export const achievementGroups = [
  'Learning habit',
  'Courses',
  'Reading',
  'Vocabulary',
  'Assessments',
  'Question writing',
] as const;
type Definition = {
  id: string;
  title: string;
  description: string;
  group: (typeof achievementGroups)[number];
  metric: keyof AchievementStats;
  target: number;
  unit: string;
};
const definitions: Definition[] = [
  {
    id: 'first-steps',
    title: 'First steps',
    description: 'Save your first focus minute.',
    group: 'Learning habit',
    metric: 'focusSeconds',
    target: 60,
    unit: 'minutes',
  },
  {
    id: 'hour-wiser',
    title: 'An hour wiser',
    description: 'Build up one hour of estimated focus time.',
    group: 'Learning habit',
    metric: 'focusSeconds',
    target: 3600,
    unit: 'minutes',
  },
  {
    id: 'deep-diver',
    title: 'Deep diver',
    description: 'Build up ten hours of estimated focus time.',
    group: 'Learning habit',
    metric: 'focusSeconds',
    target: 36000,
    unit: 'minutes',
  },
  {
    id: 'week-streak',
    title: 'Finding a rhythm',
    description: 'Reach a seven-day learning streak.',
    group: 'Learning habit',
    metric: 'bestStreak',
    target: 7,
    unit: 'days',
  },
  {
    id: 'month-streak',
    title: 'A month of momentum',
    description: 'Reach a thirty-day learning streak.',
    group: 'Learning habit',
    metric: 'bestStreak',
    target: 30,
    unit: 'days',
  },
  {
    id: 'first-class',
    title: 'Class is in session',
    description: 'Complete your first course lesson.',
    group: 'Courses',
    metric: 'lessons',
    target: 1,
    unit: 'lessons',
  },
  {
    id: 'ten-classes',
    title: 'Showing up',
    description: 'Complete ten course lessons.',
    group: 'Courses',
    metric: 'lessons',
    target: 10,
    unit: 'lessons',
  },
  {
    id: 'first-course',
    title: 'Finisher',
    description: 'Complete every lesson in a course.',
    group: 'Courses',
    metric: 'completedCourses',
    target: 1,
    unit: 'courses',
  },
  {
    id: 'five-courses',
    title: 'Lifelong learner',
    description: 'Complete five courses.',
    group: 'Courses',
    metric: 'completedCourses',
    target: 5,
    unit: 'courses',
  },
  {
    id: 'hundred-pages',
    title: 'Page turner',
    description: 'Save one hundred pages of reading progress.',
    group: 'Reading',
    metric: 'pagesRead',
    target: 100,
    unit: 'pages',
  },
  {
    id: 'first-book',
    title: 'Cover to cover',
    description: 'Finish reading your first book.',
    group: 'Reading',
    metric: 'completedBooks',
    target: 1,
    unit: 'books',
  },
  {
    id: 'three-books',
    title: 'Building a bookshelf',
    description: 'Finish reading three books.',
    group: 'Reading',
    metric: 'completedBooks',
    target: 3,
    unit: 'books',
  },
  {
    id: 'first-word-review',
    title: 'A word a day',
    description: 'Rate your first vocabulary review.',
    group: 'Vocabulary',
    metric: 'vocabularyReviews',
    target: 1,
    unit: 'reviews',
  },
  {
    id: 'ten-words',
    title: 'Word by word',
    description: 'Master ten words at their difficulty-specific review targets.',
    group: 'Vocabulary',
    metric: 'masteredWords',
    target: 10,
    unit: 'words',
  },
  {
    id: 'fifty-words',
    title: 'Growing vocabulary',
    description: 'Master fifty words at their difficulty-specific review targets.',
    group: 'Vocabulary',
    metric: 'masteredWords',
    target: 50,
    unit: 'words',
  },
  {
    id: 'first-exam',
    title: 'First checkpoint',
    description: 'Submit your first exam, including practice.',
    group: 'Assessments',
    metric: 'examsCompleted',
    target: 1,
    unit: 'exams',
  },
  {
    id: 'five-exams',
    title: 'Knowledge in action',
    description: 'Pass five different exams, including practice.',
    group: 'Assessments',
    metric: 'examsPassed',
    target: 5,
    unit: 'exams',
  },
  {
    id: 'perfect-exam',
    title: 'Full marks',
    description: 'Score one hundred percent on a completed exam.',
    group: 'Assessments',
    metric: 'perfectExams',
    target: 1,
    unit: 'exams',
  },
  {
    id: 'course-certified',
    title: 'Course certified',
    description: 'Earn a course certificate.',
    group: 'Assessments',
    metric: 'courseCertificates',
    target: 1,
    unit: 'certificates',
  },
  {
    id: 'category-certified',
    title: 'Category certified',
    description: 'Earn a category certificate.',
    group: 'Assessments',
    metric: 'categoryCertificates',
    target: 1,
    unit: 'certificates',
  },
  {
    id: 'ten-questions',
    title: 'Question builder',
    description: 'Write ten original course or category questions.',
    group: 'Question writing',
    metric: 'questionsWritten',
    target: 10,
    unit: 'questions',
  },
  {
    id: 'fifty-questions',
    title: 'Question curator',
    description: 'Write fifty original course or category questions.',
    group: 'Question writing',
    metric: 'questionsWritten',
    target: 50,
    unit: 'questions',
  },
];
export function achievementsFor(stats: AchievementStats, includeAssessments = true) {
  return definitions
    .filter((d) => includeAssessments || d.group !== 'Assessments')
    .map((d) => {
      const value = Math.max(0, stats[d.metric]);
      const divisor = d.metric === 'focusSeconds' ? 60 : 1;
      return {
        ...d,
        earned: value >= d.target,
        progress: Math.min(d.target, value) / divisor,
        target: d.target / divisor,
        percentage: Math.min(100, (value / d.target) * 100),
      };
    });
}
export type Achievement = ReturnType<typeof achievementsFor>[number];
