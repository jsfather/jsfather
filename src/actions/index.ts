'use server';
import { assessmentName } from '@/lib/assessment-names';
import { syncAssessmentNames } from '@/lib/sync-assessment-names';
import { db } from '@/db';
import { creditPractice } from '@/lib/practice-credit';
import { lessonEstimate, examEstimate } from '@/lib/practice';
import { issueEligibleCertificate } from '@/lib/issue-certificate';
import {
  courses,
  courseSessions,
  users,
  exams,
  examQuestions,
  examOptions,
  examAttempts,
  certificates,
  categoryBanks,
  sessionReviews,
} from '@/db/schema';
import { requireUser, signIn, signOut } from '@/lib/auth';
import {
  ownedCourse,
  ownedSession,
  ownedExam,
  accessibleExam,
  ownedCategoryBank,
} from '@/lib/data';
import {
  optionalScheduleCourseSchema,
  sessionSchema,
  profileSchema,
  classBankSchema,
  answersSchema,
} from '@/lib/validation';
import { generateSchedule, slugify, scoreExam } from '@/lib/learning';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { and, eq, asc, inArray, sql } from 'drizzle-orm';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assessmentDefaults } from '@/lib/assessment';
import { openGuestExam } from '@/lib/guest-exam';
import {
  addCourseSession,
  validateChapter,
  removeCourseSession,
  syncCourseSessions,
} from '@/lib/session-management';
export type ActionState = {
  error?: string;
  success?: string;
  result?: ReturnType<typeof scoreExam>;
};
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
function refresh(courseId?: string | null) {
  [
    '/activity',
    '/dashboard',
    '/courses',
    '/calendar',
    '/exams',
    '/categories',
    '/certificates',
    '/profile',
    '/practice',
  ].forEach((p) => revalidatePath(p));
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
function courseFormInput(
  form: FormData,
  defaults: { startDate: string; timezone: string; scheduledTime?: string; duration?: number },
) {
  const values = {
    ...formObject(form),
    weekdays: form.getAll('weekdays'),
    isPublic: form.get('isPublic') === 'on',
  };
  return form.get('scheduleEnabled') === 'on'
    ? values
    : {
        ...values,
        totalSessions: 0,
        startDate: defaults.startDate,
        timezone: defaults.timezone,
        scheduledTime: defaults.scheduledTime ?? '18:00',
        duration: defaults.duration ?? 60,
        weekdays: [],
      };
}
export async function createCourse(_state: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = '';
  try {
    const input = optionalScheduleCourseSchema.parse(
      courseFormInput(form, {
        startDate: formatInTimeZone(new Date(), user.timezone, 'yyyy-MM-dd'),
        timezone: user.timezone,
      }),
    );
    const dates = input.totalSessions ? generateSchedule(input) : [];
    id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(courses).values({
        ...input,
        id,
        ownerId: user.id,
        slug: slugify(input.title) + '-' + id.slice(0, 8),
        endDate: dates.length
          ? formatInTimeZone(dates.at(-1)!, input.timezone, 'yyyy-MM-dd')
          : null,
      });
      if (dates.length)
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
  const course = await ownedCourse(user.id, id);
  if (course.kind !== 'standard')
    return { error: 'Use this course’s dedicated settings to edit it.' };
  try {
    const input = z
      .object({
        ...optionalScheduleCourseSchema.shape,
        category: z.union([
          optionalScheduleCourseSchema.shape.category,
          z.literal(course.category),
        ]),
        status: z.enum(['active', 'archived']),
        totalSessions: z.coerce.number().int().min(0),
      })
      .refine((input) => input.totalSessions === 0 || input.weekdays.length > 0, {
        message: 'Select at least one class day for your schedule.',
        path: ['weekdays'],
      })
      .parse(courseFormInput(form, course));
    if (course.totalSessions > 0 && input.totalSessions !== course.totalSessions)
      return { error: 'Add or remove sessions from the course page to change its total.' };
    const scheduleChanged =
      input.totalSessions !== course.totalSessions ||
      input.startDate !== course.startDate ||
      input.scheduledTime !== course.scheduledTime ||
      input.duration !== course.duration ||
      input.timezone !== course.timezone ||
      JSON.stringify([...input.weekdays].sort()) !== JSON.stringify([...course.weekdays].sort());
    if (course.totalSessions === 0 && input.totalSessions > 1000)
      return { error: 'A timetable can contain at most 1000 sessions.' };
    const dates = scheduleChanged ? (input.totalSessions ? generateSchedule(input) : []) : null;
    const updated = await db.transaction(async (tx) => {
      const [currentCourse] = await tx
        .select()
        .from(courses)
        .where(eq(courses.id, id))
        .for('update');
      if (!currentCourse || currentCourse.totalSessions !== course.totalSessions) return false;
      if (scheduleChanged) {
        const [bank] = await tx
          .select({ id: exams.id })
          .from(exams)
          .where(and(eq(exams.courseId, id), sql`${exams.sessionId} is not null`))
          .limit(1);
        if (bank) return false;
        const sessions = await tx
          .select({
            status: courseSessions.status,
            notes: courseSessions.notes,
            chapterId: courseSessions.chapterId,
            hasReviews: sql<boolean>`exists (select 1 from ${sessionReviews} r where r.session_id = ${courseSessions.id})`,
          })
          .from(courseSessions)
          .where(eq(courseSessions.courseId, id));
        if (
          sessions.some(
            (session) =>
              session.status !== 'upcoming' ||
              session.notes ||
              session.chapterId ||
              session.hasReviews,
          )
        )
          return false;
        await tx.delete(courseSessions).where(eq(courseSessions.courseId, id));
      }
      await tx
        .update(courses)
        .set({
          ...input,
          endDate: dates
            ? dates.length
              ? formatInTimeZone(dates.at(-1)!, input.timezone, 'yyyy-MM-dd')
              : null
            : course.endDate,
          updatedAt: new Date(),
        })
        .where(and(eq(courses.id, id), eq(courses.ownerId, user.id)));
      if (dates?.length)
        await tx.insert(courseSessions).values(
          dates.map((scheduledDate, index) => ({
            courseId: id,
            title: `Session ${index + 1}`,
            sessionNumber: index + 1,
            scheduledDate,
            duration: input.duration,
          })),
        );
      await syncAssessmentNames(tx, id);
      return true;
    });
    if (!updated)
      return {
        error:
          'The course schedule can only be rebuilt before sessions have progress, notes, questions, chapter assignments or reviews. Update individual sessions instead.',
      };
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
export async function createSession(
  courseId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const course = await ownedCourse(user.id, courseId);
  if (course.kind !== 'standard') return { error: 'Only regular courses have scheduled sessions.' };
  let id = '';
  let completed = false;
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
    const session = await db.transaction(async (tx) => {
      const created = await addCourseSession(tx, course, {
        ...fields,
        scheduledDate,
        completedAt: input.status === 'completed' ? new Date() : null,
      });
      if (input.status === 'completed')
        await creditPractice(tx, {
          userId: user.id,
          courseId,
          timezone: user.timezone,
          activity: 'lesson',
          sourceKey: `lesson:${created.id}`,
          seconds: lessonEstimate(input.duration),
        });
      return created;
    });
    id = session.id;
    completed = input.status === 'completed';
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  if (completed) {
    await issueEligibleCertificate(courseId, user.id);
  }
  redirect('/sessions/' + id);
}

export async function deleteSession(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  const { course, session } = await ownedSession(user.id, id);
  if (course.kind === 'book') return { error: 'Manage this book from its reading page.' };
  if (form.get('confirmation') !== session.title)
    return { error: 'Type the session title to confirm deletion.' };
  try {
    await db.transaction((tx) => removeCourseSession(tx, course, id));
  } catch (e) {
    return failure(e);
  }
  refresh(course.id);
  revalidatePath('/sessions/' + id);
  await issueEligibleCertificate(course.id, user.id);
  redirect('/courses/' + course.id);
}

export async function updateSession(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { course, session } = await ownedSession(user.id, id);
  if (course.kind === 'book') return { error: 'Manage this book from its reading page.' };
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
    await db.transaction(async (tx) => {
      await tx
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, course.id))
        .for('update');
      await validateChapter(tx, course.id, fields.chapterId);
      await tx
        .update(courseSessions)
        .set({
          ...fields,
          scheduledDate,
          completedAt: input.status === 'completed' ? (session.completedAt ?? new Date()) : null,
          updatedAt: new Date(),
        })
        .where(eq(courseSessions.id, id));
      if (input.status === 'completed')
        await creditPractice(tx, {
          userId: user.id,
          courseId: course.id,
          timezone: user.timezone,
          activity: 'lesson',
          sourceKey: `lesson:${id}`,
          seconds: lessonEstimate(input.duration),
        });
      await syncAssessmentNames(tx, course.id);
      await syncCourseSessions(tx, course);
    });
  } catch (e) {
    return failure(e);
  }
  refresh(course.id);
  revalidatePath('/sessions/' + id);
  if (form.get('status') === 'completed') {
    await issueEligibleCertificate(course.id, user.id);
  }
  return { success: 'Session saved.' };
}
export async function setSessionStatus(id: string, status: 'completed' | 'skipped' | 'upcoming') {
  const user = await requireUser();
  const { course } = await ownedSession(user.id, id);
  if (course.kind === 'book') return;
  const valid = z.enum(['completed', 'skipped', 'upcoming']).parse(status);
  await db.transaction(async (tx) => {
    await tx
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, course.id))
      .for('update');
    const [current] = await tx.select().from(courseSessions).where(eq(courseSessions.id, id));
    if (!current) return;
    await tx
      .update(courseSessions)
      .set({
        status: valid,
        completedAt: valid === 'completed' ? (current.completedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(courseSessions.id, id));
    if (valid === 'completed')
      await creditPractice(tx, {
        userId: user.id,
        courseId: course.id,
        timezone: user.timezone,
        activity: 'lesson',
        sourceKey: `lesson:${id}`,
        seconds: lessonEstimate(current.duration),
      });
  });
  refresh(course.id);
  revalidatePath('/sessions/' + id);
  if (valid === 'completed') {
    await issueEligibleCertificate(course.id, user.id);
  }
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
  courseId: string | null,
  examId: string | null,
  sessionId: string,
  _state: ActionState,
  form: FormData,
  categoryBankId: string | null = null,
): Promise<ActionState> {
  const user = await requireUser();
  const categoryBank = categoryBankId ? await ownedCategoryBank(user.id, categoryBankId) : null;
  if (!categoryBank && !sessionId) return { error: 'Choose a class for these questions.' };
  const scope = categoryBank ? null : await ownedSession(user.id, sessionId);
  const course = scope?.course;
  const session = scope?.session;
  if (!categoryBank && session?.courseId !== courseId)
    return { error: 'Choose a class in this course.' };
  let previousSessionId: string | null = null;
  if (examId) {
    const { exam } = await ownedExam(user.id, examId);
    previousSessionId = exam.sessionId;
    if (
      exam.courseId !== courseId ||
      exam.categoryBankId !== categoryBankId ||
      exam.isFinal ||
      exam.isPractice
    )
      return { error: 'Generated assessments cannot be edited.' };
  }
  const id = examId ?? crypto.randomUUID();
  try {
    const input = classBankSchema.parse(JSON.parse(String(form.get('exam'))));
    const defaults = assessmentDefaults(input.questions);
    const settings = {
      title: categoryBank
        ? categoryBank.category + ' · Category questions'
        : assessmentName(course!.title, 'practice', session!.title),
      description: '',
      passingScore: input.passingScore ?? defaults.passingScore,
      timeLimit: input.timeLimit ?? defaults.timeLimit,
      autoTimeLimit: input.timeLimit === null,
      autoPassingScore: input.passingScore === null,
    };
    const result = await db.transaction(async (tx) => {
      if (categoryBank) {
        const [currentCategory] = await tx
          .select()
          .from(categoryBanks)
          .where(and(eq(categoryBanks.id, categoryBank.id), eq(categoryBanks.ownerId, user.id)))
          .for('update');
        if (!currentCategory) return 'This category no longer exists.';
        const [existing] = await tx
          .select({ id: exams.id })
          .from(exams)
          .where(
            and(
              eq(exams.categoryBankId, categoryBank.id),
              eq(exams.isFinal, false),
              eq(exams.isPractice, false),
            ),
          );
        if (existing && existing.id !== examId)
          return 'This category already has questions. Open its question bank to edit them.';
      } else {
        const [currentCourse] = await tx
          .select()
          .from(courses)
          .where(eq(courses.id, courseId!))
          .for('update');
        const [currentSession] = await tx
          .select()
          .from(courseSessions)
          .where(eq(courseSessions.id, sessionId))
          .for('update');
        if (!currentCourse || !currentSession) return 'This course or session no longer exists.';
        settings.title = assessmentName(currentCourse.title, 'practice', currentSession.title);
        const [existing] = await tx
          .select({ id: exams.id })
          .from(exams)
          .where(eq(exams.sessionId, sessionId))
          .limit(1);
        if (existing && existing.id !== examId)
          return 'This session already has an exam. Open its question bank to add more questions.';
      }
      if (examId) {
        await tx.execute(sql`select id from exams where id=${examId} for update`);
        const [attempt] = await tx
          .select({ id: examAttempts.id })
          .from(examAttempts)
          .where(
            and(
              eq(examAttempts.examId, examId),
              sql`${examAttempts.submittedAt} is null`,
              sql`${examAttempts.snapshot} is null`,
            ),
          )
          .limit(1);
        if (attempt)
          return 'Finish the older active attempt before editing these questions. New attempts keep independent snapshots.';
        await tx
          .update(exams)
          .set({
            title: settings.title,
            sessionId: sessionId || null,
            description: settings.description,
            passingScore: settings.passingScore,
            timeLimit: settings.timeLimit,
            autoTimeLimit: settings.autoTimeLimit,
            autoPassingScore: settings.autoPassingScore,
            published: input.published,
            isPublic: input.published,
            updatedAt: new Date(),
          })
          .where(eq(exams.id, examId));
        await tx.delete(examQuestions).where(eq(examQuestions.examId, examId));
      } else {
        await tx.insert(exams).values({
          id,
          courseId,
          sessionId: sessionId || null,
          categoryBankId,
          ...settings,
          published: input.published,
          isPublic: input.published,
        });
      }
      for (const [order, q] of input.questions.entries()) {
        const questionId = crypto.randomUUID();
        await tx.insert(examQuestions).values({
          id: questionId,
          examId: id,
          question: q.question,
          difficulty: q.difficulty,
          type: q.type,
          points: q.points,
          timeSeconds: q.timeSeconds,
          acceptedAnswers: q.acceptedAnswers,
          caseSensitive: q.caseSensitive,
          tolerance: q.tolerance,
          pairs: q.pairs,
          order,
          explanation: q.explanation,
        });
        if (q.options.length)
          await tx.insert(examOptions).values(
            q.options.map((o, i) => ({
              questionId,
              text: o.text,
              isCorrect: o.isCorrect,
              order: i,
            })),
          );
      }
      return null;
    });
    if (result) return { error: result };
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  revalidatePath('/exams/' + id);
  if (sessionId) revalidatePath('/sessions/' + sessionId);
  if (categoryBankId) revalidatePath('/categories/' + categoryBankId);
  if (previousSessionId && previousSessionId !== sessionId)
    revalidatePath('/sessions/' + previousSessionId);
  redirect(course?.kind === 'book' ? '/courses/' + courseId : '/exams/' + id);
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
  if (exam.sessionId) revalidatePath('/sessions/' + exam.sessionId);
  if (form.get('returnToSession') === 'on' && exam.sessionId)
    redirect('/sessions/' + exam.sessionId);
  if (exam.categoryBankId) {
    revalidatePath('/categories/' + exam.categoryBankId);
    redirect('/categories/' + exam.categoryBankId);
  }
  redirect('/courses/' + exam.courseId);
}
export async function startAttempt(examId: string, practiceOnly = false) {
  const requestedPractice = z.boolean().parse(practiceOnly);
  const user = await requireUser();
  const { course, categoryBank } = await accessibleExam(user.id, examId);
  const ownerId = course?.ownerId ?? categoryBank?.ownerId;
  const id = await db.transaction(async (tx) => {
    const [exam] = await tx.select().from(exams).where(eq(exams.id, examId)).for('update');
    if (!exam || (ownerId !== user.id && !exam.isPublic))
      throw new Error('This exam is no longer available for practice.');
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
    const questions = await tx
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.order));
    if (!questions.length) throw new Error('Add questions before starting an assessment.');
    const options = await tx
      .select()
      .from(examOptions)
      .where(
        inArray(
          examOptions.questionId,
          questions.map((q) => q.id),
        ),
      )
      .orderBy(asc(examOptions.order));
    const [attempt] = await tx
      .insert(examAttempts)
      .values({
        examId,
        userId: user.id,
        snapshot: {
          practiceOnly:
            requestedPractice ||
            exam.isPractice ||
            (!!exam.categoryBankId && !exam.isFinal) ||
            ownerId !== user.id,
          timeLimit: exam.timeLimit,
          passingScore: exam.passingScore,
          questions: questions.map((q) => ({
            ...q,
            options: options.filter((o) => o.questionId === q.id),
          })),
        },
      })
      .returning({ id: examAttempts.id });
    return attempt.id;
  });
  redirect('/exams/' + examId + '/take/' + id);
}
export async function setExamPublic(
  examId: string,
  published: boolean,
  _state: ActionState,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  await ownedExam(user.id, examId);
  await db
    .update(exams)
    .set({ isPublic: published, updatedAt: new Date() })
    .where(eq(exams.id, examId));
  revalidatePath('/exams/' + examId);
  revalidatePath('/practice/' + examId);
  revalidatePath('/practice');
  return { success: published ? 'Public link enabled.' : 'Public link disabled.' };
}
export async function submitGuestExam(
  token: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const exam = openGuestExam(token);
    const [visible] = await db
      .select({ id: exams.id })
      .from(exams)
      .where(and(eq(exams.id, exam.examId), eq(exams.isPublic, true)));
    if (!visible) return { error: 'This exam is no longer public.' };
    const answers = answersSchema.parse(JSON.parse(String(form.get('answers'))));
    const expired = Date.now() > exam.expiresAt + 15000;
    return { result: scoreExam(exam.questions, expired ? {} : answers, exam.passingScore) };
  } catch {
    return { error: 'This practice session is invalid. Reload to start again.' };
  }
}
export async function updateAssessmentSettings(
  examId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  const { exam } = await ownedExam(user.id, examId);
  try {
    const input = z
      .object({
        passingScore: z.coerce.number().int().min(1).max(100),
        timeLimit: z.coerce.number().int().min(1).max(60000),
      })
      .parse(formObject(form));
    const updated = await db.transaction(async (tx) => {
      await tx.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)).for('update');
      const [attempt] = await tx
        .select({ id: examAttempts.id })
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.examId, examId),
            sql`${examAttempts.submittedAt} is null`,
            sql`${examAttempts.snapshot} is null`,
          ),
        )
        .limit(1);
      if (attempt) return false;
      await tx
        .update(exams)
        .set({ ...input, autoTimeLimit: false, autoPassingScore: false, updatedAt: new Date() })
        .where(eq(exams.id, examId));
      return true;
    });
    if (!updated)
      return {
        error: 'Finish the older active attempt before changing settings.',
      };
  } catch (error) {
    return failure(error);
  }
  if (exam.categoryBankId) revalidatePath('/categories/' + exam.categoryBankId);
  revalidatePath('/exams/' + examId);
  revalidatePath('/practice/' + examId);
  return { success: 'Assessment settings saved.' };
}
export async function generateAssessment(
  courseId: string,
  mode: 'practice' | 'final',
  _state: ActionState,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  const parsed = z.enum(['practice', 'final']).safeParse(mode);
  if (!parsed.success) return { error: 'Choose practice or final assessment.' };
  const result = await buildCourseAssessment(courseId, user.id, parsed.data);
  if (result.error) return { error: result.error };
  await startAttempt(result.id!);
  return {};
}
export async function assignExamClass(
  examId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  const { exam } = await ownedExam(user.id, examId);
  const sessionId = String(form.get('sessionId') ?? '');
  if (!sessionId) return { error: 'Choose a class.' };
  const { session, course } = await ownedSession(user.id, sessionId);
  if (exam.isFinal || exam.isPractice || session.courseId !== exam.courseId)
    return { error: 'Choose a class in this course.' };
  try {
    const error = await db.transaction(async (tx) => {
      const [currentCourse] = await tx
        .select()
        .from(courses)
        .where(eq(courses.id, course.id))
        .for('update');
      const [currentSession] = await tx
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, sessionId))
        .for('update');
      if (!currentCourse || !currentSession) return 'This course or session no longer exists.';
      const [existing] = await tx
        .select({ id: exams.id })
        .from(exams)
        .where(eq(exams.sessionId, sessionId))
        .limit(1);
      if (existing && existing.id !== examId)
        return 'This session already has an exam. Open its question bank to add more questions.';
      await tx
        .update(exams)
        .set({
          sessionId,
          title: assessmentName(currentCourse.title, 'practice', currentSession.title),
          updatedAt: new Date(),
        })
        .where(eq(exams.id, examId));
      return null;
    });
    if (error) return { error };
  } catch (e) {
    return failure(e);
  }
  revalidatePath('/sessions/' + sessionId);
  if (exam.sessionId && exam.sessionId !== sessionId) revalidatePath('/sessions/' + exam.sessionId);
  refresh(exam.courseId);
  revalidatePath('/exams/' + examId);
  return { success: 'Questions assigned to this class. Existing attempts are preserved.' };
}
async function buildCourseAssessment(
  courseId: string,
  userId: string,
  mode: 'practice' | 'final',
): Promise<{ id?: string; error?: string }> {
  const course = await ownedCourse(userId, courseId);
  if (course.kind === 'vocabulary')
    return { error: 'Vocabulary courses use word reviews instead of exams.' };
  const id = crypto.randomUUID();
  try {
    const error = await db.transaction(async (tx) => {
      const [currentCourse] = await tx
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .for('update');
      if (!currentCourse) return 'This course no longer exists.';
      await tx
        .select({ id: exams.id })
        .from(exams)
        .where(and(eq(exams.courseId, courseId), sql`${exams.sessionId} is not null`))
        .for('share');
      const pool = await tx
        .select({ question: examQuestions, sessionId: exams.sessionId })
        .from(examQuestions)
        .innerJoin(exams, eq(examQuestions.examId, exams.id))
        .innerJoin(courseSessions, eq(exams.sessionId, courseSessions.id))
        .where(and(eq(exams.courseId, courseId), sql`${exams.sessionId} is not null`))
        .orderBy(asc(courseSessions.sessionNumber), asc(examQuestions.order));
      const candidates = pool
        .filter((q) => q.sessionId !== null)
        .map((q) => ({ ...q.question, sessionId: q.sessionId! }));
      if (!candidates.length)
        return course.kind === 'book'
          ? 'Add at least one book question before generating an assessment.'
          : 'Add at least one question to any class before generating an assessment.';
      const selected = candidates;
      const defaults = assessmentDefaults(selected);
      await tx.insert(exams).values({
        id,
        courseId,
        isFinal: mode === 'final',
        isPractice: mode === 'practice',
        title: assessmentName(currentCourse.title, mode),
        published: false,
        ...defaults,
        autoTimeLimit: true,
        autoPassingScore: true,
      });
      const sourceOptions = await tx
        .select()
        .from(examOptions)
        .where(
          inArray(
            examOptions.questionId,
            selected.map((q) => q.id),
          ),
        )
        .orderBy(asc(examOptions.order));
      const copiedQuestions = selected.map((question, order) => ({
        id: crypto.randomUUID(),
        examId: id,
        question: question.question,
        difficulty: question.difficulty,
        type: question.type,
        points: question.points,
        timeSeconds: question.timeSeconds,
        acceptedAnswers: question.acceptedAnswers,
        caseSensitive: question.caseSensitive,
        tolerance: question.tolerance,
        pairs: question.pairs,
        order,
        explanation: question.explanation,
      }));
      const copiedIds = new Map(selected.map((q, i) => [q.id, copiedQuestions[i].id]));
      const copiedOptions = sourceOptions.map((o) => ({
        questionId: copiedIds.get(o.questionId)!,
        text: o.text,
        isCorrect: o.isCorrect,
        order: o.order,
      }));
      for (let offset = 0; offset < copiedQuestions.length; offset += 1000)
        await tx.insert(examQuestions).values(copiedQuestions.slice(offset, offset + 1000));
      for (let offset = 0; offset < copiedOptions.length; offset += 1000)
        await tx.insert(examOptions).values(copiedOptions.slice(offset, offset + 1000));
      return null;
    });
    if (error) return { error };
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  return { id };
}
export async function submitAttempt(
  attemptId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  let examId = '';
  let categoryBankId: string | null = null;
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
        .select({ exam: exams, course: courses, categoryBank: categoryBanks })
        .from(exams)
        .leftJoin(courses, eq(exams.courseId, courses.id))
        .leftJoin(categoryBanks, eq(exams.categoryBankId, categoryBanks.id))
        .where(eq(exams.id, attempt.examId));
      if (!row) throw new Error('Exam not found.');
      categoryBankId = row.exam.categoryBankId;
      // Serialize certificate eligibility with completion-triggered issuance.
      if (row.course)
        await tx
          .select({ id: courses.id })
          .from(courses)
          .where(eq(courses.id, row.course.id))
          .for('update');
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
            .orderBy(asc(examOptions.order))
        : [];
      const expired =
        Date.now() >
        attempt.startedAt.getTime() +
          (attempt.snapshot?.timeLimit ?? row.exam.timeLimit) * 60000 +
          15000;
      const result = scoreExam(
        attempt.snapshot?.questions ??
          questions.map((q) => ({ ...q, options: options.filter((o) => o.questionId === q.id) })),
        expired ? {} : answers,
        attempt.snapshot?.passingScore ?? row.exam.passingScore,
      );
      const submittedAt = new Date();
      await creditPractice(tx, {
        userId: user.id,
        courseId: row.exam.courseId,
        timezone: user.timezone,
        activity: 'exam',
        sourceKey: `exam:${attemptId}`,
        seconds: examEstimate(
          attempt.startedAt,
          submittedAt,
          attempt.snapshot?.timeLimit ?? row.exam.timeLimit,
        ),
        at: submittedAt,
      });
      await tx
        .update(examAttempts)
        .set({ ...result, submittedAt })
        .where(eq(examAttempts.id, attemptId));
      const sessions = row.course
        ? await tx
            .select()
            .from(courseSessions)
            .where(eq(courseSessions.courseId, row.course.id))
            .for('share')
        : [];
      if (
        result.passed &&
        row.exam.isFinal &&
        !attempt.snapshot?.practiceOnly &&
        (row.course?.ownerId ?? row.categoryBank?.ownerId) === user.id &&
        (row.categoryBank ||
          (sessions.length > 0 && sessions.every((s) => s.status === 'completed')))
      )
        await tx
          .insert(certificates)
          .values({
            attemptId,
            userId: user.id,
            courseId: row.exam.courseId,
            categoryBankId: row.exam.categoryBankId,
            recipientName: user.name ?? user.username,
            courseTitle: row.categoryBank?.category ?? row.course!.title,
            percentage: result.percentage,
          })
          .onConflictDoNothing();
    });
  } catch (e) {
    return failure(e);
  }
  refresh();
  if (categoryBankId) revalidatePath('/categories/' + categoryBankId);
  revalidatePath('/exams/' + examId);
  redirect('/exams/' + examId + '/results/' + attemptId);
}
