import type { Achievement } from './achievements';
type Details = { meaning: string; requirement: string; counting: string };
export const achievementDetails: Record<string, Details> = {
  'first-steps': {
    meaning:
      'Every learning habit begins with one small step. This sprout celebrates the first saved focus minute.',
    requirement: 'Accumulate at least 1 minute of estimated focus time.',
    counting:
      'Completed lessons, new reading progress, rated vocabulary reviews, and submitted exams add estimated practice time. Leaving a page open does not add time.',
  },
  'hour-wiser': {
    meaning:
      'Small study sessions add up. The clock-carrying owl celebrates the first full hour of focused learning.',
    requirement: 'Accumulate 60 minutes of estimated focus time across learning activities.',
    counting:
      'Time can come from several days and different courses. The hour does not have to be completed in a single session.',
  },
  'deep-diver': {
    meaning:
      'The diving whale recognizes a sustained investment in learning, one session at a time.',
    requirement: 'Accumulate 600 minutes (10 hours) of estimated focus time.',
    counting:
      'All saved practice time contributes, including lessons, reading, vocabulary, and exams. Time is estimated from saved activity, rather than from an open browser tab.',
  },
  'week-streak': {
    meaning:
      'A little consistency keeps the flame alive. This badge celebrates a full week of meeting the daily learning goal.',
    requirement:
      'Reach a best streak of 7 consecutive days with at least 5 estimated focus minutes each day.',
    counting:
      'A day with less than 5 minutes does not extend the streak. Days follow the learner’s profile timezone. A completed best streak still counts after the current streak ends.',
  },
  'month-streak': {
    meaning:
      'The crowned flame celebrates a learning routine that has lasted an entire thirty-day stretch.',
    requirement:
      'Reach a best streak of 30 consecutive days with at least 5 estimated focus minutes each day.',
    counting:
      'The best saved streak is used, so it does not need to be the current streak. Daily boundaries follow the learner’s profile timezone.',
  },
  'first-class': {
    meaning: 'The school bell marks the first lesson brought to completion.',
    requirement: 'Mark at least 1 lesson in a standard course as completed.',
    counting:
      'Only lessons with a completed status count. Book reading and vocabulary reviews have their own achievements. Reopening the lesson changes the current completion count.',
  },
  'ten-classes': {
    meaning: 'The little fox and its notebooks celebrate the habit of showing up for class.',
    requirement: 'Complete 10 lessons across standard courses.',
    counting:
      'Completed lessons can come from different courses. Each lesson counts once, and upcoming, skipped, or reopened lessons do not count as completed.',
  },
  'first-course': {
    meaning: 'A graduation trophy for following a course all the way through.',
    requirement: 'Complete every lesson in at least 1 standard course.',
    counting:
      'A course must have at least one lesson, and every lesson must be marked completed. Empty courses do not count. An exam or certificate is not required for this badge.',
  },
  'five-courses': {
    meaning: 'The learning planet celebrates a growing universe of completed courses.',
    requirement: 'Complete every lesson in 5 different standard courses.',
    counting:
      'Each course counts once and must contain at least one lesson. Reading books and mastering vocabulary are recognized by separate badges.',
  },
  'hundred-pages': {
    meaning: 'The bookworm celebrates a hundred pages of saved reading progress.',
    requirement: 'Accumulate 100 credited pages across books.',
    counting:
      'New reading progress adds credited pages. Moving backwards and reading the same credited pages again does not add them a second time.',
  },
  'first-book': {
    meaning: 'An open book celebrates the first reading journey completed from cover to cover.',
    requirement: 'Reach the final page of at least 1 book.',
    counting:
      'The saved reading position must reach the book’s total page count. Moving the reading position backwards changes whether the book is currently complete.',
  },
  'three-books': {
    meaning: 'The cat and its stack of books celebrate a small but well-read bookshelf.',
    requirement: 'Reach the final page of 3 different books.',
    counting:
      'Each book counts once when its saved reading position reaches its total page count. Finishing the same book again does not create an additional completed book.',
  },
  'first-word-review': {
    meaning: 'The friendly speech bubble celebrates the first step in a vocabulary routine.',
    requirement: 'Rate at least 1 vocabulary review.',
    counting:
      'A rated review counts whether the word was remembered or needed another look. Simply revealing a card without rating it does not complete the review.',
  },
  'ten-words': {
    meaning: 'The flashcard owl celebrates ten words that have reached their mastery targets.',
    requirement:
      'Master 10 words: easy words need 5 successful reviews, medium words 10, and hard words 15.',
    counting:
      'Each mastered word counts once. Failed recalls do not add successful reviews. A word below its difficulty’s target does not yet count as mastered.',
  },
  'fifty-words': {
    meaning: 'The word tree celebrates a vocabulary that keeps growing through successful recall.',
    requirement:
      'Master 50 words using the difficulty-specific targets: 5 successful reviews for easy, 10 for medium, and 15 for hard.',
    counting:
      'Mastery is measured per word, not by the total number of review attempts. Repeated reviews of a mastered word do not count as additional mastered words.',
  },
  'first-exam': {
    meaning: 'The cheerful checklist celebrates putting knowledge to the test for the first time.',
    requirement: 'Submit at least 1 saved exam attempt.',
    counting:
      'Practice exams count, and a passing score is not required. An attempt that has started but has not been submitted does not count.',
  },
  'five-exams': {
    meaning: 'The target badge celebrates knowledge put into action across several assessments.',
    requirement: 'Pass 5 different saved exams, including practice exams.',
    counting:
      'Each exam counts once toward the target, even if it has several passing attempts. Only submitted, passing attempts count.',
  },
  'perfect-exam': {
    meaning: 'A crowned star for getting every available point on an exam.',
    requirement: 'Score 100% on at least 1 submitted exam with a positive maximum score.',
    counting:
      'Practice exams are eligible. An unfinished attempt, an empty exam, or a score below 100% does not meet this requirement.',
  },
  'course-certified': {
    meaning: 'The graduate owl recognizes a course achievement backed by an issued certificate.',
    requirement: 'Earn at least 1 course certificate.',
    counting:
      'A course certificate requires a passing final assessment and completion of every course lesson. The badge is based on an issued certificate, not just a passing practice score.',
  },
  'category-certified': {
    meaning: 'The compass shield celebrates knowledge assessed across an entire category.',
    requirement: 'Earn at least 1 category certificate by passing a category exam.',
    counting:
      'Category exams combine original questions added directly to the category and questions from its courses. Course completion is not required. Public practice does not issue certificates.',
  },
  'ten-questions': {
    meaning: 'The pencil in the clouds celebrates building a personal question bank.',
    requirement: 'Write 10 original course or category questions.',
    counting:
      'Original questions in course and direct category question banks count. Copies created when an exam is generated do not add to this total.',
  },
  'fifty-questions': {
    meaning:
      'The question wizard celebrates a substantial collection of original learning prompts.',
    requirement: 'Write 50 original course or category questions.',
    counting:
      'Questions can be spread across several question banks. Generated exam copies are excluded, and deleted original questions no longer contribute to the current count.',
  },
};
export function achievementRequirementProgress(a: Achievement) {
  const unit = a.target === 1 ? a.unit.replace(/s$/, '') : a.unit;
  return `${Math.floor(a.progress).toLocaleString('en-US')} / ${a.target.toLocaleString('en-US')} ${unit}`;
}
