import { sql } from 'drizzle-orm';
import {
  pgTable,
  foreignKey,
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
import type { AttemptSnapshot } from '@/lib/assessment';
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
export const questionTypeEnum = pgEnum('question_type', [
  'multiple_choice',
  'true_false',
  'multiple_select',
  'short_answer',
  'fill_blank',
  'numeric',
  'ordering',
  'matching',
]);
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
  universityName: text('university_name').default('jsfather').notNull(),
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
    kind: text('kind').$type<'standard' | 'vocabulary' | 'book'>().default('standard').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description').default('').notNull(),
    category: text('category').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    color: text('color').default('teal').notNull(),
    status: courseStatusEnum('status').default('active').notNull(),
    bookAuthor: text('book_author').default('').notNull(),
    totalPages: integer('total_pages'),
    currentPage: integer('current_page').default(0).notNull(),
    creditedPages: integer('credited_pages').default(0).notNull(),
    readingNotes: text('reading_notes').default('').notNull(),
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
    check('course_kind_valid', sql`${t.kind} in ('standard', 'vocabulary', 'book')`),
    check(
      'book_pages_valid',
      sql`${t.currentPage} >= 0 and (${t.kind} <> 'book' or (${t.totalPages} is not null and ${t.totalPages} > 0 and ${t.currentPage} <= ${t.totalPages}))`,
    ),
    check('course_count_nonnegative', sql`${t.totalSessions}>=0`),
    check('course_duration_positive', sql`${t.duration}>0`),
  ],
);
// Chapters group video lessons without turning folders into scheduled sessions.
export const courseChapters = pgTable(
  'course_chapters',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: integer('position').notNull(),
    ...dates,
  },
  (t) => [
    uniqueIndex('chapter_course_id_unique').on(t.courseId, t.id),
    index('chapter_course_position_idx').on(t.courseId, t.position),
  ],
);
export type CourseChapter = typeof courseChapters.$inferSelect;

export const courseSessions = pgTable(
  'course_sessions',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    chapterId: text('chapter_id'),
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
    foreignKey({
      columns: [t.courseId, t.chapterId],
      foreignColumns: [courseChapters.courseId, courseChapters.id],
      name: 'session_chapter_same_course',
    }),
  ],
);
export const sessionReviews = pgTable(
  'session_reviews',
  {
    id: id(),
    sessionId: text('session_id')
      .notNull()
      .references(() => courseSessions.id, { onDelete: 'cascade' }),
    keyPoints: text('key_points').notNull(),
    questions: text('questions').default('').notNull(),
    confidence: text('confidence').$type<'revisit' | 'developing' | 'confident'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('session_review_history_idx').on(t.sessionId, t.createdAt),
    check(
      'session_review_confidence_valid',
      sql`${t.confidence} in ('revisit', 'developing', 'confident')`,
    ),
  ],
);
export type SessionReview = typeof sessionReviews.$inferSelect;

// Session status and notes are the normalized progress record for this single-owner LMS.
// No second table duplicates completion percentages or completion flags.
// Direct category questions have a bank separate from generated exam snapshots.
export const categoryBanks = pgTable(
  'category_banks',
  {
    id: id(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    ...dates,
  },
  (t) => [uniqueIndex('category_banks_owner_category_idx').on(t.ownerId, t.category)],
);

export const exams = pgTable(
  'exams',
  {
    id: id(),
    categoryBankId: text('category_bank_id').references(() => categoryBanks.id, {
      onDelete: 'cascade',
    }),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => courseSessions.id, { onDelete: 'cascade' }),
    isFinal: boolean('is_final').default(false).notNull(),
    isPractice: boolean('is_practice').default(false).notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    passingScore: integer('passing_score').default(70).notNull(),
    timeLimit: integer('time_limit').default(30).notNull(),
    autoTimeLimit: boolean('auto_time_limit').default(false).notNull(),
    autoPassingScore: boolean('auto_passing_score').default(false).notNull(),
    published: boolean('published').default(false).notNull(),
    ...dates,
  },
  (t) => [
    index('exams_course_idx').on(t.courseId),
    uniqueIndex('exams_category_bank_unique')
      .on(t.categoryBankId)
      .where(sql`not ${t.isFinal} and not ${t.isPractice}`),
    check(
      'exam_scope_valid',
      sql`(${t.courseId} is not null and ${t.categoryBankId} is null) or (${t.courseId} is null and ${t.categoryBankId} is not null and ${t.sessionId} is null )`,
    ),
    uniqueIndex('exams_session_unique').on(t.sessionId),
    check(
      'course_practice_scope',
      sql`not ${t.isPractice} or (${t.sessionId} is null and not ${t.isFinal})`,
    ),
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
    difficulty: text('difficulty').$type<'easy' | 'medium' | 'hard'>().default('medium').notNull(),
    type: questionTypeEnum('type').notNull(),
    points: integer('points').default(1).notNull(),
    timeSeconds: integer('time_seconds').default(90).notNull(),
    acceptedAnswers: jsonb('accepted_answers').$type<string[]>().default([]).notNull(),
    caseSensitive: boolean('case_sensitive').default(false).notNull(),
    tolerance: doublePrecision('tolerance').default(0).notNull(),
    pairs: jsonb('pairs').$type<{ left: string; right: string }[]>().default([]).notNull(),
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
    snapshot: jsonb('snapshot').$type<AttemptSnapshot>(),
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
    categoryBankId: text('category_bank_id').references(() => categoryBanks.id, {
      onDelete: 'cascade',
    }),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'cascade' }),
    recipientName: text('recipient_name').notNull(),
    courseTitle: text('course_title').notNull(),
    percentage: doublePrecision('percentage').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('certificates_user_idx').on(t.userId),
    check(
      'certificate_scope_valid',
      sql`(${t.courseId} is not null) <> (${t.categoryBankId} is not null)`,
    ),
  ],
);
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type CourseSession = typeof courseSessions.$inferSelect;

// Vocabulary membership grants learning access, never course management access.
export const vocabularyMembers = pgTable(
  'vocabulary_members',
  {
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<'collaborator' | 'learner'>().default('collaborator').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.userId] }),
    index('vocabulary_members_user_idx').on(t.userId),
    check('vocabulary_member_role_valid', sql`${t.role} in ('collaborator', 'learner')`),
  ],
);
export const vocabularyWords = pgTable(
  'vocabulary_words',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    explanation: text('explanation').notNull(),
    persianMeaning: text('persian_meaning').default('').notNull(),
    pronunciationIpa: text('pronunciation_ipa').default('').notNull(),
    pronunciationFa: text('pronunciation_fa').default('').notNull(),
    awlSublist: integer('awl_sublist'),
    relatedForms: jsonb('related_forms').$type<string[]>().default([]).notNull(),
    sourceUrl: text('source_url').default('').notNull(),
    example: text('example').default('').notNull(),
    difficulty: text('difficulty').$type<'easy' | 'medium' | 'hard'>().default('medium').notNull(),
    addedOn: text('added_on').notNull(),
    version: integer('version').default(1).notNull(),
    ...dates,
  },
  (t) => [
    index('vocabulary_words_course_idx').on(t.courseId, t.addedOn),
    uniqueIndex('vocabulary_word_unique').on(t.courseId, sql`lower(trim(${t.word}))`),
    check('vocabulary_difficulty_valid', sql`${t.difficulty} in ('easy', 'medium', 'hard')`),
    check('vocabulary_awl_sublist_valid', sql`${t.awlSublist} between 1 and 10`),
    check('vocabulary_version_positive', sql`${t.version} > 0`),
  ],
);
export const vocabularyProgress = pgTable(
  'vocabulary_progress',
  {
    wordId: text('word_id')
      .notNull()
      .references(() => vocabularyWords.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    successfulReviews: integer('successful_reviews').default(0).notNull(),
    totalReviews: integer('total_reviews').default(0).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).defaultNow().notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.wordId, t.userId] }),
    index('vocabulary_progress_user_due_idx').on(t.userId, t.dueAt),
    check(
      'vocabulary_progress_counts',
      sql`${t.successfulReviews} >= 0 and ${t.totalReviews} >= ${t.successfulReviews}`,
    ),
  ],
);
// A single pending card per course/learner makes multi-tab reviews and retries idempotent.
export const vocabularyReviews = pgTable(
  'vocabulary_reviews',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    wordId: text('word_id')
      .notNull()
      .references(() => vocabularyWords.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wordVersion: integer('word_version').notNull(),
    wordSnapshot: jsonb('word_snapshot')
      .$type<{
        word: string;
        explanation: string;
        example: string;
        difficulty: 'easy' | 'medium' | 'hard';
      }>()
      .notNull(),
    direction: text('direction').$type<'word' | 'meaning'>().notNull(),
    revealedAt: timestamp('revealed_at', { withTimezone: true }),
    remembered: boolean('remembered'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('vocabulary_review_pending')
      .on(t.courseId, t.userId)
      .where(sql`${t.submittedAt} is null`),
    index('vocabulary_reviews_user_idx').on(t.userId, t.createdAt),
    check('vocabulary_review_direction', sql`${t.direction} in ('word', 'meaning')`),
  ],
);
export type VocabularyWord = typeof vocabularyWords.$inferSelect;

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    lastSentDay: text('last_sent_day'),
    lastStreakDay: text('last_streak_day'),
    ...dates,
  },
  (t) => [index('push_subscriptions_user_idx').on(t.userId)],
);

export const bookBookmarks = pgTable(
  'book_bookmarks',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    page: integer('page').notNull(),
    label: text('label').default('').notNull(),
    notes: text('notes').default('').notNull(),
    ...dates,
  },
  (t) => [
    index('book_bookmarks_course_idx').on(t.courseId, t.page),
    check('book_bookmark_page_positive', sql`${t.page} > 0`),
  ],
);
export type BookBookmark = typeof bookBookmarks.$inferSelect;

export const practiceSessions = pgTable(
  'practice_sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'set null' }),
    attemptId: text('attempt_id').references(() => examAttempts.id, { onDelete: 'set null' }),
    sourceKey: text('source_key').unique(),
    day: text('day'),
    activity: text('activity').$type<'lesson' | 'reading' | 'vocabulary' | 'exam'>().notNull(),
    seconds: integer('seconds').default(0).notNull(),
    lastSequence: integer('last_sequence').default(0).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('practice_one_active_per_user')
      .on(t.userId)
      .where(sql`${t.endedAt} is null`),
    index('practice_user_course_idx').on(t.userId, t.courseId),
    check('practice_seconds_valid', sql`${t.seconds} >= 0 and ${t.lastSequence} >= 0`),
    check(
      'practice_activity_valid',
      sql`${t.activity} in ('lesson', 'reading', 'vocabulary', 'exam')`,
    ),
  ],
);
export const practiceDays = pgTable(
  'practice_days',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    seconds: integer('seconds').default(0).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    check('practice_day_seconds_valid', sql`${t.seconds} >= 0`),
  ],
);
