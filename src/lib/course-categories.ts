// Shared, exact category values let future category exams group courses consistently.
export const courseCategoryGroups = [
  {
    label: 'Computer science & engineering',
    categories: [
      'Frontend',
      'Backend',
      'Full-stack',
      'DevOps',
      'Cloud Computing',
      'Artificial Intelligence',
      'Machine Learning',
      'Data Science',
      'Data Engineering',
      'Cybersecurity',
      'Computer Networks',
      'Databases',
      'Algorithms & Data Structures',
      'Operating Systems',
      'Computer Architecture',
      'Software Engineering',
      'Software Testing',
      'Software Architecture & System Design',
      'Software Best Practices',
      'Mobile Development',
      'Game Development',
      'Embedded Systems & IoT',
      'Programming Fundamentals',
      'Human-Computer Interaction',
    ],
  },
  {
    label: 'Language learning',
    categories: [
      'English',
      'Persian',
      'Arabic',
      'French',
      'German',
      'Spanish',
      'Italian',
      'Portuguese',
      'Russian',
      'Turkish',
      'Chinese',
      'Japanese',
      'Korean',
      'Other Languages',
    ],
  },
] as const;
export const courseCategories = courseCategoryGroups.flatMap((group) => [...group.categories]);
export function isCourseCategory(value: string) {
  return courseCategories.some((category) => category === value);
}
