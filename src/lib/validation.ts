import { z } from 'zod';
import { courseCategories } from './course-categories';
import { questionTypes, isTypedQuestion } from './assessment';
const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Choose a valid IANA timezone.');
export const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid date.');
export const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid class time.');
const title = z.string().trim().min(2).max(160);
export const courseSchema = z.object({
  title,
  description: z.string().trim().max(5000),
  category: z.enum(courseCategories, { error: 'Choose a course category.' }),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  color: z.enum(['teal', 'blue', 'violet', 'amber', 'rose', 'sky', 'indigo', 'orange', 'fuchsia']),
  totalSessions: z.coerce.number().int().min(1).max(1000),
  startDate: localDate,
  scheduledTime: localTime,
  duration: z.coerce.number().int().min(5).max(480),
  timezone,
  weekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .transform((v) => [...new Set(v)]),
  isPublic: z.boolean(),
});
// An empty course has no timetable; scheduled courses retain the full schedule validation.
export const optionalScheduleCourseSchema = courseSchema
  .extend({
    totalSessions: z.coerce.number().int().min(0).max(1000),
    weekdays: z
      .array(z.coerce.number().int().min(0).max(6))
      .max(7)
      .transform((values) => [...new Set(values)]),
  })
  .refine((input) => input.totalSessions === 0 || input.weekdays.length > 0, {
    message: 'Select at least one class day for your schedule.',
    path: ['weekdays'],
  });

export const sessionSchema = z.object({
  title,
  description: z.string().max(5000),
  date: localDate,
  time: localTime,
  duration: z.coerce.number().int().min(5).max(480),
  notes: z.string().max(20000),
  status: z.enum(['upcoming', 'in_progress', 'completed', 'skipped']),
});
const url = z.union([
  z.literal(''),
  z
    .string()
    .url()
    .max(500)
    .refine((v) => /^https?:\/\//.test(v), 'Use an http or https URL.'),
]);
export const profileSchema = z.object({
  name: title,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.'),
  bio: z.string().max(1000),
  location: z.string().max(100),
  website: url,
  githubUrl: url,
  linkedinUrl: url,
  timezone,
  publicProfile: z.boolean(),
  publicProgress: z.boolean(),
  showCourses: z.boolean(),
  showExamScores: z.boolean(),
});
export const questionSchema = z
  .object({
    // Questions may include long, fenced code examples. PostgreSQL text has no practical UI limit.
    question: z.string().trim().min(2),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    type: z.enum(questionTypes),
    points: z.coerce.number().int().min(1).max(100),
    timeSeconds: z.coerce.number().int().min(5).max(3600).default(90),
    acceptedAnswers: z.array(z.string().trim().min(1).max(5000)).max(20).default([]),
    caseSensitive: z.boolean().default(false),
    tolerance: z.coerce.number().min(0).max(1000000).default(0),
    pairs: z
      .array(
        z.object({
          left: z.string().trim().min(1).max(1000),
          right: z.string().trim().min(1).max(1000),
        }),
      )
      .max(12)
      .default([]),
    explanation: z.string().max(3000),
    options: z
      .array(z.object({ text: z.string().trim().min(1).max(1000), isCorrect: z.boolean() }))
      .max(12),
  })
  .superRefine((q, ctx) => {
    if (isTypedQuestion(q.type)) {
      if (!q.acceptedAnswers.length)
        ctx.addIssue({
          code: 'custom',
          message: 'Add an accepted answer for each typed question.',
        });
      if (
        q.type === 'numeric' &&
        (q.acceptedAnswers.length !== 1 || !Number.isFinite(Number(q.acceptedAnswers[0])))
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Numeric questions need one finite numeric answer.',
        });
      return;
    }
    if (q.type === 'matching') {
      if (
        q.pairs.length < 2 ||
        new Set(q.pairs.map((p) => p.left)).size !== q.pairs.length ||
        new Set(q.pairs.map((p) => p.right)).size !== q.pairs.length
      )
        ctx.addIssue({ code: 'custom', message: 'Matching needs at least two unique pairs.' });
      return;
    }
    if (q.options.length < 2 || new Set(q.options.map((o) => o.text)).size !== q.options.length)
      ctx.addIssue({ code: 'custom', message: 'Add at least two distinct options.' });
    if (q.type === 'ordering') return;
    if (q.type === 'multiple_select') {
      if (!q.options.some((o) => o.isCorrect))
        ctx.addIssue({ code: 'custom', message: 'Select at least one correct answer.' });
      return;
    }
    if (q.options.filter((o) => o.isCorrect).length !== 1)
      ctx.addIssue({ code: 'custom', message: 'Every question needs exactly one correct answer.' });
    if (
      q.type === 'true_false' &&
      (q.options.length !== 2 || q.options[0].text !== 'True' || q.options[1].text !== 'False')
    )
      ctx.addIssue({
        code: 'custom',
        message: 'True/false questions need True and False options.',
      });
  });
export const examSchema = z.object({
  title,
  description: z.string().max(5000),
  passingScore: z.coerce.number().int().min(1).max(100),
  timeLimit: z.coerce.number().int().min(1).max(240),
  published: z.boolean(),
  questions: z.array(questionSchema).min(1),
});
export const answersSchema = z.record(
  z.string().uuid(),
  z.union([z.string().max(20000), z.array(z.string().max(1000)).max(12)]),
);
export type CourseInput = z.infer<typeof courseSchema>;
export type ExamInput = z.infer<typeof examSchema>;
export const classBankSchema = z.object({
  published: z.boolean(),
  passingScore: z.coerce.number().int().min(1).max(100).nullable(),
  timeLimit: z.coerce.number().int().min(1).max(60000).nullable(),
  questions: z.array(questionSchema).min(1),
});
export type ClassBankInput = z.infer<typeof classBankSchema>;

export const bookCourseSchema = courseSchema
  .pick({
    title: true,
    description: true,
    category: true,
    difficulty: true,
    color: true,
  })
  .extend({
    bookAuthor: z.string().trim().max(200),
    totalPages: z.coerce.number().int().min(1).max(2000000),
    isPublic: z.boolean(),
  });
export const bookProgressSchema = z.object({
  currentPage: z.coerce.number().int().min(0),
});
export const bookBookmarkSchema = z.object({
  page: z.coerce.number().int().min(1),
  label: z.string().trim().max(160),
  notes: z.string().trim().max(10000),
});
