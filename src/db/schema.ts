import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
  check,
  jsonb,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';
const dates = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);
export const courseStatusEnum = pgEnum('course_status', ['active', 'archived']);
export const sessionStatusEnum = pgEnum('session_status', [
  'upcoming',
  'in_progress',
  'completed',
  'skipped',
]);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'true_false']);
export const users = pgTable('users', {
  id: id(),
  name: text('name'),
  email: text('email').unique().notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  username: text('username')
    .notNull()
    .unique()
    .$defaultFn(() => 'student-' + crypto.randomUUID().slice(0, 8)),
  bio: text('bio').default('').notNull(),
  location: text('location').default('').notNull(),
  website: text('website').default('').notNull(),
  githubUrl: text('github_url').default('').notNull(),
  linkedinUrl: text('linkedin_url').default('').notNull(),
  timezone: text('timezone').default('Asia/Tehran').notNull(),
  publicProfile: boolean('public_profile').default(false).notNull(),
  publicProgress: boolean('public_progress').default(false).notNull(),
  showCourses: boolean('show_courses').default(false).notNull(),
  showExamScores: boolean('show_exam_scores').default(false).notNull(),
  ...dates,
});
export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('accounts_user_idx').on(t.userId),
  ],
);
export const authSessions = pgTable(
  'auth_sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId)],
);
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
export const courses = pgTable(
  'courses',
  {
    id: id(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description').default('').notNull(),
    category: text('category').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    color: text('color').default('teal').notNull(),
    status: courseStatusEnum('status').default('active').notNull(),
    totalSessions: integer('total_sessions').notNull(),
    scheduledTime: text('scheduled_time').notNull(),
    duration: integer('duration').notNull(),
    timezone: text('timezone').notNull(),
    weekdays: jsonb('weekdays').$type<number[]>().notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    isPublic: boolean('is_public').default(false).notNull(),
    ...dates,
  },
  (t) => [
    uniqueIndex('courses_owner_slug_idx').on(t.ownerId, t.slug),
    index('courses_owner_idx').on(t.ownerId),
    check('course_count_positive', sql`${t.totalSessions}>0`),
    check('course_duration_positive', sql`${t.duration}>0`),
  ],
);
export const courseSessions = pgTable(
  'course_sessions',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    sessionNumber: integer('session_number').notNull(),
    scheduledDate: timestamp('scheduled_date', { withTimezone: true }).notNull(),
    duration: integer('duration').notNull(),
    status: sessionStatusEnum('status').default('upcoming').notNull(),
    notes: text('notes').default('').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...dates,
  },
  (t) => [
    uniqueIndex('session_number_idx').on(t.courseId, t.sessionNumber),
    index('session_schedule_idx').on(t.scheduledDate),
    index('session_course_idx').on(t.courseId),
  ],
);
// Session status and notes are the normalized progress record for this single-owner LMS.
// No second table duplicates completion percentages or completion flags.
export const exams = pgTable(
  'exams',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    passingScore: integer('passing_score').default(70).notNull(),
    timeLimit: integer('time_limit').default(30).notNull(),
    published: boolean('published').default(false).notNull(),
    ...dates,
  },
  (t) => [
    index('exams_course_idx').on(t.courseId),
    check('passing_score_range', sql`${t.passingScore} BETWEEN 0 AND 100`),
  ],
);
export const examQuestions = pgTable(
  'exam_questions',
  {
    id: id(),
    examId: text('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    type: questionTypeEnum('type').notNull(),
    points: integer('points').default(1).notNull(),
    order: integer('order').notNull(),
    explanation: text('explanation').default('').notNull(),
  },
  (t) => [
    index('questions_exam_idx').on(t.examId),
    uniqueIndex('questions_order_idx').on(t.examId, t.order),
    check('question_points_positive', sql`${t.points}>0`),
  ],
);
export const examOptions = pgTable(
  'exam_options',
  {
    id: id(),
    questionId: text('question_id')
      .notNull()
      .references(() => examQuestions.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    order: integer('order').notNull(),
  },
  (t) => [index('options_question_idx').on(t.questionId)],
);
export type AttemptReview = {
  questionId: string;
  question: string;
  selected: string | null;
  correct: string;
  isCorrect: boolean;
  points: number;
  earned: number;
  explanation: string;
};
export const examAttempts = pgTable(
  'exam_attempts',
  {
    id: id(),
    examId: text('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    score: integer('score'),
    maxScore: integer('max_score'),
    percentage: doublePrecision('percentage'),
    passed: boolean('passed'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    review: jsonb('review').$type<AttemptReview[]>(),
  },
  (t) => [
    index('attempts_user_idx').on(t.userId),
    index('attempts_exam_idx').on(t.examId),
    uniqueIndex('one_active_attempt_idx')
      .on(t.userId, t.examId)
      .where(sql`${t.submittedAt} IS NULL`),
  ],
);
export const certificates = pgTable(
  'certificates',
  {
    id: id(),
    attemptId: text('attempt_id')
      .notNull()
      .unique()
      .references(() => examAttempts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    recipientName: text('recipient_name').notNull(),
    courseTitle: text('course_title').notNull(),
    percentage: doublePrecision('percentage').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('certificates_user_idx').on(t.userId)],
);
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type CourseSession = typeof courseSessions.$inferSelect;
