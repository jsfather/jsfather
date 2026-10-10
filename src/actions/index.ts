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
  classBankSchema,
  answersSchema,
} from '@/lib/validation';
import { generateSchedule, slugify, scoreExam } from '@/lib/learning';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { and, eq, asc, desc, inArray, sql } from 'drizzle-orm';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { selectFinalQuestions } from '@/lib/final-selection';
import { assessmentDefaults } from '@/lib/assessment';
import { openGuestExam } from '@/lib/guest-exam';
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
  const course = await ownedCourse(user.id, id);
  try {
    const input = courseSchema.extend({ status: z.enum(['active', 'archived']) }).parse({
      ...formObject(form),
      weekdays: form.getAll('weekdays'),
      isPublic: form.get('isPublic') === 'on',
    });
    const scheduleChanged =
      input.totalSessions !== course.totalSessions ||
      input.startDate !== course.startDate ||
      input.scheduledTime !== course.scheduledTime ||
      input.duration !== course.duration ||
      input.timezone !== course.timezone ||
      JSON.stringify([...input.weekdays].sort()) !== JSON.stringify([...course.weekdays].sort());
    const dates = scheduleChanged ? generateSchedule(input) : null;
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from courses where id=${id} for update`);
      if (scheduleChanged) {
        const [bank] = await tx
          .select({ id: exams.id })
          .from(exams)
          .where(and(eq(exams.courseId, id), sql`${exams.sessionId} is not null`))
          .limit(1);
        if (bank) return false;
        const sessions = await tx
          .select({ status: courseSessions.status, notes: courseSessions.notes })
          .from(courseSessions)
          .where(eq(courseSessions.courseId, id));
        if (sessions.some((session) => session.status !== 'upcoming' || session.notes))
          return false;
        await tx.delete(courseSessions).where(eq(courseSessions.courseId, id));
      }
      await tx
        .update(courses)
        .set({
          ...input,
          endDate: dates
            ? formatInTimeZone(dates.at(-1)!, input.timezone, 'yyyy-MM-dd')
            : course.endDate,
          updatedAt: new Date(),
        })
        .where(and(eq(courses.id, id), eq(courses.ownerId, user.id)));
      if (dates)
        await tx.insert(courseSessions).values(
          dates.map((scheduledDate, index) => ({
            courseId: id,
            title: `Session ${index + 1}`,
            sessionNumber: index + 1,
            scheduledDate,
            duration: input.duration,
          })),
        );
      return true;
    });
    if (!updated)
      return {
        error:
          'The course schedule can only be rebuilt before classes begin, notes or class questions are added. Update individual sessions instead.',
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
  if (form.get('status') === 'completed') {
    await buildFinal(course.id, user.id, true);
    await issueEligibleCertificate(course.id, user.id);
  }
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
  if (valid === 'completed') {
    await buildFinal(course.id, user.id, true);
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
  courseId: string,
  examId: string | null,
  sessionId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!sessionId) return { error: 'Choose a class for these questions.' };
  const { session } = await ownedSession(user.id, sessionId);
  if (session.courseId !== courseId) return { error: 'Choose a class in this course.' };
  if (examId) {
    const { exam } = await ownedExam(user.id, examId);
    if (exam.courseId !== courseId || exam.isFinal)
      return { error: 'Generated finals cannot be edited.' };
  }
  const id = examId ?? crypto.randomUUID();
  try {
    const input = classBankSchema.parse(JSON.parse(String(form.get('exam'))));
    const defaults = assessmentDefaults(input.questions);
    const settings = {
      title: session.title.slice(0, 140) + ' · Questions',
      description: '',
      passingScore: input.passingScore ?? defaults.passingScore,
      timeLimit: input.timeLimit ?? defaults.timeLimit,
      autoTimeLimit: input.timeLimit === null,
      autoPassingScore: input.passingScore === null,
    };
    const result = await db.transaction(async (tx) => {
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
        if (attempt) return false;
        await tx
          .update(exams)
          .set({
            title: settings.title,
            sessionId,
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
          sessionId,
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
      return true;
    });
    if (!result)
      return {
        error:
          'Finish the older active attempt before editing these questions. New attempts keep independent snapshots.',
      };
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  revalidatePath('/exams/' + id);
  await buildFinal(courseId, user.id, true);
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
  await ownedExam(user.id, examId);
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
  revalidatePath('/exams/' + examId);
  revalidatePath('/practice/' + examId);
  return { success: 'Assessment settings saved.' };
}
export async function generateFinal(courseId: string, _state: ActionState): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  const result = await buildFinal(courseId, user.id);
  if (result.error) return { error: result.error };
  refresh(courseId);
  redirect('/exams/' + result.id);
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
  const { session } = await ownedSession(user.id, sessionId);
  if (exam.isFinal || session.courseId !== exam.courseId)
    return { error: 'Choose a class in this course.' };
  await db.update(exams).set({ sessionId, updatedAt: new Date() }).where(eq(exams.id, examId));
  await buildFinal(exam.courseId, user.id, true);
  refresh(exam.courseId);
  revalidatePath('/exams/' + examId);
  return { success: 'Questions assigned to this class. Existing attempts are preserved.' };
}
async function buildFinal(
  courseId: string,
  userId: string,
  onlyIfMissing = false,
): Promise<{ id?: string; error?: string }> {
  const course = await ownedCourse(userId, courseId);
  const id = crypto.randomUUID();
  try {
    const error = await db.transaction(async (tx) => {
      await tx.select().from(courses).where(eq(courses.id, courseId)).for('update');
      if (onlyIfMissing) {
        const [existing] = await tx
          .select({ id: exams.id })
          .from(exams)
          .where(and(eq(exams.courseId, courseId), eq(exams.isFinal, true)))
          .limit(1);
        if (existing) return 'A final already exists.';
      }
      const sessions = await tx
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.courseId, courseId))
        .for('update');
      if (onlyIfMissing && (!sessions.length || sessions.some((s) => s.status !== 'completed')))
        return 'Complete every class before generating your final.';
      await tx
        .select({ id: exams.id })
        .from(exams)
        .where(and(eq(exams.courseId, courseId), eq(exams.isFinal, false)))
        .for('share');
      const pool = await tx
        .select({ question: examQuestions, sessionId: exams.sessionId })
        .from(examQuestions)
        .innerJoin(exams, eq(examQuestions.examId, exams.id))
        .where(and(eq(exams.courseId, courseId), eq(exams.isFinal, false)));
      const candidates = pool
        .filter((q) => q.sessionId !== null)
        .map((q) => ({ ...q.question, sessionId: q.sessionId! }));
      if (!candidates.length)
        return 'Add at least one question to any class before generating an assessment.';
      const selected = selectFinalQuestions(
        candidates,
        Math.max(30, new Set(candidates.map((q) => q.sessionId)).size),
      );
      const defaults = assessmentDefaults(selected);
      // The answer validator supports up to 1000 classes/questions in a final.
      await tx.insert(exams).values({
        id,
        courseId,
        isFinal: true,
        title: course.title.slice(0, 140) + ' · Final assessment',
        published: false,
        ...defaults,
        autoTimeLimit: true,
        autoPassingScore: true,
      });
      for (const [order, question] of selected.entries()) {
        const questionId = crypto.randomUUID();
        await tx.insert(examQuestions).values({
          id: questionId,
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
        });
        const options = await tx
          .select()
          .from(examOptions)
          .where(eq(examOptions.questionId, question.id))
          .orderBy(asc(examOptions.order));
        if (options.length)
          await tx.insert(examOptions).values(
            options.map((o) => ({
              questionId,
              text: o.text,
              isCorrect: o.isCorrect,
              order: o.order,
            })),
          );
      }
      return null;
    });
    if (error) return { error };
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  return { id };
}
async function issueEligibleCertificate(courseId: string, userId: string) {
  await db.transaction(async (tx) => {
    const [course] = await tx
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.ownerId, userId)))
      .for('update');
    if (!course) return;
    const sessions = await tx
      .select({ status: courseSessions.status })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, courseId))
      .for('share');
    if (!sessions.length || sessions.some((session) => session.status !== 'completed')) return;
    const [attempt] = await tx
      .select({ id: examAttempts.id, percentage: examAttempts.percentage })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .where(
        and(
          eq(exams.courseId, courseId),
          eq(exams.isFinal, true),
          eq(examAttempts.userId, userId),
          eq(examAttempts.passed, true),
        ),
      )
      .orderBy(desc(examAttempts.submittedAt))
      .limit(1);
    if (!attempt || attempt.percentage === null) return;
    const [user] = await tx
      .select({ name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, userId));
    await tx
      .insert(certificates)
      .values({
        attemptId: attempt.id,
        userId,
        courseId,
        recipientName: user.name ?? user.username,
        courseTitle: course.title,
        percentage: attempt.percentage,
      })
      .onConflictDoNothing();
  });
  refresh(courseId);
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
      // Serialize certificate eligibility with completion-triggered issuance.
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
      await tx
        .update(examAttempts)
        .set({ ...result, submittedAt: new Date() })
        .where(eq(examAttempts.id, attemptId));
      const sessions = await tx
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.courseId, row.course.id))
        .for('share');
      if (
        result.passed &&
        row.exam.isFinal &&
        sessions.length > 0 &&
        sessions.every((s) => s.status === 'completed')
      )
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
