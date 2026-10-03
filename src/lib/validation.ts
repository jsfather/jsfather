import { z } from 'zod';
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
  category: z.string().trim().min(1).max(80),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  color: z.enum(['teal', 'blue', 'violet', 'amber', 'rose']),
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
    type: z.enum(['multiple_choice', 'true_false']),
    points: z.coerce.number().int().min(1).max(100),
    explanation: z.string().max(3000),
    options: z
      .array(z.object({ text: z.string().trim().min(1).max(1000), isCorrect: z.boolean() }))
      .min(2)
      .max(6),
  })
  .superRefine((q, ctx) => {
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
  questions: z.array(questionSchema).min(1).max(100),
});
export const answersSchema = z
  .record(z.string().uuid(), z.string().uuid())
  .refine((v) => Object.keys(v).length <= 100, 'Too many answers.');
export type CourseInput = z.infer<typeof courseSchema>;
export type ExamInput = z.infer<typeof examSchema>;
