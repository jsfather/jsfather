'use server';
import { db } from '@/db';
import {
  courses,
  courseSessions,
  users,
  exams,
  examQuestions,
  examOptions,
  examAttempts,
  certificates,
} from '@/db/schema';
import { requireUser, signIn, signOut } from '@/lib/auth';
import { ownedCourse, ownedSession, ownedExam } from '@/lib/data';
import {
  courseSchema,
  sessionSchema,
  profileSchema,
  examSchema,
  answersSchema,
} from '@/lib/validation';
import { generateSchedule, slugify, scoreExam } from '@/lib/learning';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { and, eq, asc, inArray, sql } from 'drizzle-orm';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
export type ActionState = { error?: string; success?: string };
function formObject(form: FormData) {
  return Object.fromEntries(form.entries());
}
function failure(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof z.ZodError)
    return {
      error: error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join(' '),
    };
  console.error(
    'University mutation failed:',
    error instanceof Error ? error.name : 'Unknown error',
  );
  return { error: 'We could not save this change. Please try again.' };
}
function refresh(courseId?: string) {
  ['/dashboard', '/courses', '/calendar', '/exams', '/certificates', '/profile'].forEach((p) =>
    revalidatePath(p),
  );
  if (courseId) revalidatePath('/courses/' + courseId);
  revalidatePath('/u', 'layout');
}
export async function googleLogin() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.AUTH_SECRET
  )
    redirect('/login?error=Configuration');
  await signIn('google', { redirectTo: '/dashboard' });
}
export async function logout() {
  await signOut({ redirectTo: '/' });
}
export async function createCourse(_state: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = '';
  try {
    const input = courseSchema.parse({
      ...formObject(form),
      weekdays: form.getAll('weekdays'),
      isPublic: form.get('isPublic') === 'on',
    });
    const dates = generateSchedule(input);
    id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(courses).values({
        ...input,
        id,
        ownerId: user.id,
        slug: slugify(input.title) + '-' + id.slice(0, 8),
        endDate: formatInTimeZone(dates.at(-1)!, input.timezone, 'yyyy-MM-dd'),
      });
      await tx.insert(courseSessions).values(
        dates.map((date, i) => ({
          courseId: id,
          title: `Session ${i + 1}`,
          sessionNumber: i + 1,
          scheduledDate: date,
          duration: input.duration,
        })),
      );
    });
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect('/courses/' + id);
}
export async function editCourse(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  await ownedCourse(user.id, id);
  try {
    const input = courseSchema
      .pick({
        title: true,
        description: true,
        category: true,
        difficulty: true,
        color: true,
        isPublic: true,
      })
      .extend({ status: z.enum(['active', 'archived']) })
      .parse({ ...formObject(form), isPublic: form.get('isPublic') === 'on' });
    await db
      .update(courses)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(courses.id, id), eq(courses.ownerId, user.id)));
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  return { success: 'Course updated.' };
}
export async function deleteCourse(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const course = await ownedCourse(user.id, id);
  if (form.get('confirmation') !== course.title)
    return { error: 'Type the course title to confirm deletion.' };
  try {
    await db.delete(courses).where(and(eq(courses.id, id), eq(courses.ownerId, user.id)));
  } catch (e) {
    return failure(e);
  }
  refresh();
  redirect('/courses');
}
export async function updateSession(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { course, session } = await ownedSession(user.id, id);
  try {
    const input = sessionSchema.parse(formObject(form));
    const scheduledDate = fromZonedTime(`${input.date}T${input.time}:00`, course.timezone);
    if (
      formatInTimeZone(scheduledDate, course.timezone, "yyyy-MM-dd'T'HH:mm:ss") !==
      `${input.date}T${input.time}:00`
    )
      return {
        error: 'This class time does not exist due to daylight saving. Choose another time.',
      };
    const { date, time, ...fields } = input;
    void date;
    void time;
    await db
      .update(courseSessions)
      .set({
        ...fields,
        scheduledDate,
        completedAt: input.status === 'completed' ? (session.completedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(courseSessions.id, id));
  } catch (e) {
    return failure(e);
  }
  refresh(course.id);
  revalidatePath('/sessions/' + id);
  return { success: 'Session saved.' };
}
export async function setSessionStatus(id: string, status: 'completed' | 'skipped' | 'upcoming') {
  const user = await requireUser();
  const { course, session } = await ownedSession(user.id, id);
  const valid = z.enum(['completed', 'skipped', 'upcoming']).parse(status);
  await db
    .update(courseSessions)
    .set({
      status: valid,
      completedAt: valid === 'completed' ? (session.completedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(courseSessions.id, id));
  refresh(course.id);
  revalidatePath('/sessions/' + id);
}
export async function updateProfile(_state: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    const input = profileSchema.parse({
      ...formObject(form),
      publicProfile: form.get('publicProfile') === 'on',
      publicProgress: form.get('publicProgress') === 'on',
      showCourses: form.get('showCourses') === 'on',
      showExamScores: form.get('showExamScores') === 'on',
    });
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, input.username));
    if (existing && existing.id !== user.id) return { error: 'This username is already taken.' };
    await db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } catch (e) {
    return failure(e);
  }
  refresh();
  revalidatePath('/settings');
  return { success: 'Profile and privacy settings saved.' };
}
export async function saveExam(
  courseId: string,
  examId: string | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  await ownedCourse(user.id, courseId);
  if (examId) await ownedExam(user.id, examId);
  const id = examId ?? crypto.randomUUID();
  try {
    const input = examSchema.parse(JSON.parse(String(form.get('exam'))));
    const result = await db.transaction(async (tx) => {
      if (examId) {
        await tx.execute(sql`select id from exams where id=${examId} for update`);
        const [attempt] = await tx
          .select({ id: examAttempts.id })
          .from(examAttempts)
          .where(eq(examAttempts.examId, examId))
          .limit(1);
        if (attempt) return false;
        await tx
          .update(exams)
          .set({
            title: input.title,
            description: input.description,
            passingScore: input.passingScore,
            timeLimit: input.timeLimit,
            published: input.published,
            updatedAt: new Date(),
          })
          .where(eq(exams.id, examId));
        await tx.delete(examQuestions).where(eq(examQuestions.examId, examId));
      } else {
        await tx.insert(exams).values({
          id,
          courseId,
          title: input.title,
          description: input.description,
          passingScore: input.passingScore,
          timeLimit: input.timeLimit,
          published: input.published,
        });
      }
      for (const [order, q] of input.questions.entries()) {
        const questionId = crypto.randomUUID();
        await tx.insert(examQuestions).values({
          id: questionId,
          examId: id,
          question: q.question,
          type: q.type,
          points: q.points,
          order,
          explanation: q.explanation,
        });
        await tx.insert(examOptions).values(
          q.options.map((o, i) => ({
            questionId,
            text: o.text,
            isCorrect: o.isCorrect,
            order: i,
          })),
        );
      }
      return true;
    });
    if (!result)
      return {
        error:
          'This exam already has attempts and is locked. Create a new exam to change its questions.',
      };
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  revalidatePath('/exams/' + id);
  redirect('/exams/' + id);
}
export async function deleteExam(
  examId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { exam } = await ownedExam(user.id, examId);
  if (form.get('confirmation') !== exam.title)
    return { error: 'Type the exam title to confirm deletion.' };
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from exams where id=${examId} for update`);
      await tx.delete(exams).where(eq(exams.id, examId));
    });
  } catch (e) {
    return failure(e);
  }
  refresh(exam.courseId);
  redirect('/exams');
}
export async function startAttempt(examId: string) {
  const user = await requireUser();
  await ownedExam(user.id, examId);
  const id = await db.transaction(async (tx) => {
    const [exam] = await tx.select().from(exams).where(eq(exams.id, examId)).for('update');
    if (!exam.published) throw new Error('Publish this exam before taking it.');
    const [active] = await tx
      .select()
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.examId, examId),
          eq(examAttempts.userId, user.id),
          sql`${examAttempts.submittedAt} is null`,
        ),
      );
    if (active) return active.id;
    const [attempt] = await tx
      .insert(examAttempts)
      .values({ examId, userId: user.id })
      .returning({ id: examAttempts.id });
    return attempt.id;
  });
  redirect('/exams/' + examId + '/take/' + id);
}
export async function submitAttempt(
  attemptId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  let examId = '';
  try {
    const answers = answersSchema.parse(JSON.parse(String(form.get('answers'))));
    await db.transaction(async (tx) => {
      const [attempt] = await tx
        .select()
        .from(examAttempts)
        .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, user.id)))
        .for('update');
      if (!attempt) throw new Error('Attempt not found.');
      examId = attempt.examId;
      if (attempt.submittedAt) return;
      const [row] = await tx
        .select({ exam: exams, course: courses })
        .from(exams)
        .innerJoin(courses, eq(exams.courseId, courses.id))
        .where(and(eq(exams.id, attempt.examId), eq(courses.ownerId, user.id)));
      if (!row) throw new Error('Exam not found.');
      const questions = await tx
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.examId, examId))
        .orderBy(asc(examQuestions.order));
      const options = questions.length
        ? await tx
            .select()
            .from(examOptions)
            .where(
              inArray(
                examOptions.questionId,
                questions.map((q) => q.id),
              ),
            )
        : [];
      const expired = Date.now() > attempt.startedAt.getTime() + row.exam.timeLimit * 60000 + 15000;
      const result = scoreExam(
        questions.map((q) => ({ ...q, options: options.filter((o) => o.questionId === q.id) })),
        expired ? {} : answers,
        row.exam.passingScore,
      );
      await tx
        .update(examAttempts)
        .set({ ...result, submittedAt: new Date() })
        .where(eq(examAttempts.id, attemptId));
      if (result.passed)
        await tx
          .insert(certificates)
          .values({
            attemptId,
            userId: user.id,
            courseId: row.course.id,
            recipientName: user.name ?? user.username,
            courseTitle: row.course.title,
            percentage: result.percentage,
          })
          .onConflictDoNothing();
    });
  } catch (e) {
    return failure(e);
  }
  refresh();
  revalidatePath('/exams/' + examId);
  redirect('/exams/' + examId + '/results/' + attemptId);
}
