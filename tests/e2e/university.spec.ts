import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as schema from '../../src/db/schema';
config({ path: '.env.local' });
config();
const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client);
const userId = randomUUID(),
  otherId = randomUUID(),
  token = randomUUID(),
  otherToken = randomUUID(),
  username = 'e2e-' + randomUUID().slice(0, 8);
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
let courseId = '',
  examId = '',
  attemptId = '',
  certificateId = '',
  privateId = '',
  privateSlug = '',
  publicSlug = '';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db.insert(schema.users).values([
    { id: userId, email: `${userId}@example.test`, name: 'Test Learner', username },
    { id: otherId, email: `${otherId}@example.test`, name: 'Other Learner' },
  ]);
  await db.insert(schema.authSessions).values([
    { userId, sessionToken: token, expires: new Date(Date.now() + 3600000) },
    { userId: otherId, sessionToken: otherToken, expires: new Date(Date.now() + 3600000) },
  ]);
});
test.afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  await db.delete(schema.users).where(eq(schema.users.id, otherId));
  await client.end();
});
test('complete learning workflow, privacy, and authorization', async ({ page, browser }) => {
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back, Test.' })).toBeVisible();
  await page.getByRole('link', { name: 'Create course', exact: true }).first().click();
  await page.getByLabel('Course name').fill('TypeScript Engineering');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Build a strong understanding of TypeScript.');
  await page.getByLabel('Category', { exact: true }).fill('Frontend');
  await page.getByLabel('Number of sessions').fill('3');
  await page.getByLabel('Public course').check();
  await page.getByRole('button', { name: 'Create course', exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  courseId = page.url().split('/').at(-1)!;
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, courseId));
  publicSlug = course.slug;
  expect(course.ownerId).toBe(userId);
  expect(
    (
      await db
        .select()
        .from(schema.courseSessions)
        .where(eq(schema.courseSessions.courseId, courseId))
    ).length,
  ).toBe(3);
  await page.getByRole('link').filter({ hasText: 'Session 01' }).first().click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split('/').at(-1)!;
  await page.getByLabel('Study notes').fill('PRIVATE_STUDY_NOTES_123');
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByRole('status')).toContainText('Session saved.');
  await page.getByRole('button', { name: 'Mark as completed' }).click();
  await expect(page.getByRole('button', { name: 'Reopen session' })).toBeVisible();
  await page.goto('/courses/' + courseId);
  await expect(page.getByText('33%', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Create exam', exact: true }).click();
  await page.getByLabel('Exam title').fill('TypeScript Final Exam');
  await page
    .getByLabel('Question text')
    .first()
    .fill(
      'Which keyword declares a block scoped variable?\n```ts\nconst answer: number = 42;\nconsole.log(answer);\n```',
    );
  await expect(page.getByLabel('Question text').first()).not.toHaveAttribute('maxlength');
  for (const [i, text] of ['let', 'var', 'function', 'with'].entries())
    await page.getByLabel(`Question 1, option ${i + 1}`, { exact: true }).fill(text);
  await page
    .getByLabel('Answer explanation')
    .first()
    .fill('PRIVATE_ANSWER_KEY_123: let is block scoped.');
  await page.getByRole('button', { name: 'Add question', exact: true }).click();
  await page
    .getByLabel('Question text')
    .nth(1)
    .fill('A closure retains access to its lexical scope.');
  await page.getByLabel('Question type').nth(1).selectOption('true_false');
  await page.getByLabel('Publish this exam').check();
  await page.getByRole('button', { name: 'Save exam' }).click();
  await expect(page).toHaveURL(/\/exams\/[0-9a-f-]{36}$/);
  examId = page.url().split('/').at(-1)!;
  await page.getByRole('link', { name: 'Edit exam', exact: true }).click();
  await expect(page.getByLabel('Question text').first()).toHaveValue(/const answer: number = 42/);
  await page.getByRole('button', { name: 'Save exam', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/exams/${examId}$`));
  await page.getByRole('button', { name: 'Start exam', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  attemptId = page.url().split('/').at(-1)!;
  await expect(page.locator('.question-code')).toContainText('const answer: number = 42;');
  await expect(page.locator('.question-code .token-keyword')).toContainText('const');
  expect(await page.content()).not.toContain('PRIVATE_ANSWER_KEY_123');
  expect(await page.content()).not.toContain('isCorrect');
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio').first().check();
  await page.reload();
  await expect(page.getByText('2 of 2 answered')).toBeVisible();
  await page.getByRole('button', { name: 'Submit exam', exact: true }).click();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await expect(page.locator('.review-question .question-code')).toContainText(
    'console.log(answer);',
  );
  await expect(page.getByText('PRIVATE_ANSWER_KEY_123: let is block scoped.')).toBeVisible();
  await page.getByRole('link', { name: 'View certificate' }).click();
  await expect(page).toHaveURL(/\/certificates\/[0-9a-f-]{36}$/);
  certificateId = page.url().split('/').at(-1)!;
  await expect(
    page.getByRole('heading', { name: 'Certificate of Achievement', exact: true }),
  ).toBeVisible();
  await page.goto('/exams/' + examId + '/edit');
  await expect(page.getByRole('heading', { name: 'This exam is locked' })).toBeVisible();
  // Even a replayed owner-bound Server Action must check the current requester.
  const replay = await browser.newContext();
  await replay.addCookies([
    { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  const replayPage = await replay.newPage();
  await replayPage.goto(base + '/sessions/' + sessionId);
  await replayPage.getByLabel('Study notes').fill('IMPOSTOR_NOTES');
  await replay.addCookies([
    { name: 'authjs.session-token', value: otherToken, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  await replayPage.getByRole('button', { name: 'Save session' }).click();
  await expect(
    replayPage.getByRole('heading', { name: 'This page isn’t available.' }),
  ).toBeVisible();
  expect(
    (
      await db.select().from(schema.courseSessions).where(eq(schema.courseSessions.id, sessionId))
    )[0].notes,
  ).toBe('PRIVATE_STUDY_NOTES_123');
  await replay.close();
  // An expired attempt receives no credit even if valid answers are submitted.
  await page.goto('/exams/' + examId);
  await page.getByRole('button', { name: 'Start exam', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  const lateAttempt = page.url().split('/').at(-1)!;
  await page.getByRole('radio').first().check();
  await db
    .update(schema.examAttempts)
    .set({ startedAt: new Date(Date.now() - 120 * 60000) })
    .where(eq(schema.examAttempts.id, lateAttempt));
  await page.getByRole('button', { name: 'Submit exam', exact: true }).click();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  expect(
    (await db.select().from(schema.certificates).where(eq(schema.certificates.userId, userId)))
      .length,
  ).toBe(1);
  await page.goto('/settings');
  await page.getByLabel('Public profile', { exact: true }).check();
  await page.getByLabel('Public learning progress', { exact: true }).check();
  await page.getByLabel('Show courses', { exact: true }).check();
  await page.getByLabel('Show exam scores', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  privateId = randomUUID();
  privateSlug = 'hidden-' + privateId.slice(0, 8);
  await db.insert(schema.courses).values({
    id: privateId,
    ownerId: userId,
    title: 'SECRET_PRIVATE_COURSE_123',
    slug: privateSlug,
    description: 'SECRET_PRIVATE_DESCRIPTION_123',
    category: 'Private',
    difficulty: 'advanced',
    totalSessions: 1,
    scheduledTime: '09:00',
    duration: 60,
    timezone: 'Asia/Tehran',
    weekdays: [1],
    startDate: '2026-10-01',
    isPublic: false,
  });
  await db.insert(schema.courseSessions).values({
    courseId: privateId,
    title: 'SECRET_SESSION',
    sessionNumber: 1,
    duration: 60,
    scheduledDate: new Date(),
    status: 'completed',
  });
  const anonymous = await browser.newContext();
  const anon = await anonymous.newPage();
  const dashboardResponse = await anon.goto(base + '/dashboard');
  expect(dashboardResponse?.status()).toBe(200);
  await expect(anon).toHaveURL(/\/login$/);
  await anon.goto(base + '/u/' + username);
  expect(await anon.content()).not.toContain('SECRET_PRIVATE');
  expect(await anon.content()).not.toContain('PRIVATE_STUDY_NOTES');
  await expect(anon.getByText('Exams passed', { exact: true })).toHaveCount(0);
  await expect(anon.getByText('Certificates earned', { exact: true })).toHaveCount(0);
  await expect(anon.getByText('Public courses', { exact: true }).last()).toBeVisible();
  let response = await anon.goto(`${base}/u/${username}/courses/${privateSlug}`);
  expect(response?.status()).toBe(404);
  response = await anon.goto(`${base}/u/${username}/courses/${publicSlug}`);
  expect(response?.status()).toBe(200);
  expect(await anon.content()).not.toContain('Best exam score');
  expect(await anon.content()).not.toContain('PRIVATE_ANSWER_KEY');
  response = await anon.goto(`${base}/u/${username}/certificates/${certificateId}`);
  expect(response?.status()).toBe(404);
  const other = await browser.newContext();
  await other.addCookies([
    { name: 'authjs.session-token', value: otherToken, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  const otherPage = await other.newPage();
  for (const path of [
    `/courses/${courseId}`,
    `/courses/${courseId}/edit`,
    `/sessions/${sessionId}`,
    `/exams/${examId}`,
    `/exams/${examId}/edit`,
    `/exams/${examId}/take/${attemptId}`,
    `/exams/${examId}/results/${attemptId}`,
    `/certificates/${certificateId}`,
  ]) {
    const r = await otherPage.goto(base + path);
    expect(r?.status(), path).toBe(404);
    expect(await otherPage.content()).not.toContain('PRIVATE_STUDY_NOTES');
  }
  await page.goto('/settings');
  await page.getByLabel('Show exam scores', { exact: true }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  response = await anon.goto(`${base}/u/${username}/certificates/${certificateId}`);
  expect(response?.status()).toBe(200);
  await page.goto('/settings');
  await page.getByLabel('Public learning progress', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  response = await anon.goto(`${base}/u/${username}/courses/${publicSlug}`);
  expect(response?.status()).toBe(200);
  expect(await anon.content()).not.toContain('sessions completed');
  expect(await anon.content()).not.toContain('Best exam score');
  response = await anon.goto(`${base}/u/${username}/certificates/${certificateId}`);
  expect(response?.status()).toBe(404);
  await page.goto('/settings');
  await page.getByLabel('Public profile', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  response = await anon.goto(base + '/u/' + username);
  expect(response?.status()).toBe(404);
  await page.goto('/calendar?view=month');
  await expect(page.getByRole('heading', { name: 'Your timetable' })).toBeVisible();
  await page.getByRole('link', { name: 'Day', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Week', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Week', exact: true }).click();
  await expect(page.locator('.timetable')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByText('1 fully completed', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '/tmp/jsfather-dashboard.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Welcome back, Test.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -244, 0)');
  await page.screenshot({
    path: '/tmp/jsfather-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/courses/${courseId}/edit`);
  await page.getByLabel('Course name').fill('TypeScript Engineering Updated');
  await page.getByRole('button', { name: 'Save course' }).click();
  await expect(page.getByRole('status')).toContainText('Course updated');
  expect(
    (await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)))[0].title,
  ).toBe('TypeScript Engineering Updated');
  await page.locator('input[name=confirmation]').fill('TypeScript Engineering Updated');
  await page.getByRole('button', { name: 'Delete course', exact: true }).click();
  await expect(page).toHaveURL(base + '/courses');
  expect(
    (await db.select().from(schema.certificates).where(eq(schema.certificates.id, certificateId)))
      .length,
  ).toBe(0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(base + '/');
  expect(
    (
      await db
        .select()
        .from(schema.authSessions)
        .where(
          and(eq(schema.authSessions.userId, userId), eq(schema.authSessions.sessionToken, token)),
        )
    ).length,
  ).toBe(0);
  await anonymous.close();
  await other.close();
});

test('deletes a draft exam after an exact-title confirmation', async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  const draftCourseId = randomUUID();
  const draftExamId = randomUUID();
  await db.insert(schema.courses).values({
    id: draftCourseId,
    ownerId: userId,
    title: 'Draft Exam Course',
    slug: `draft-exam-${draftCourseId.slice(0, 8)}`,
    description: '',
    category: 'Testing',
    difficulty: 'beginner',
    totalSessions: 1,
    scheduledTime: '09:00',
    duration: 30,
    timezone: 'Asia/Tehran',
    weekdays: [1],
    startDate: '2026-10-01',
  });
  await db.insert(schema.exams).values({
    id: draftExamId,
    courseId: draftCourseId,
    title: 'Disposable Draft Exam',
    description: '',
  });
  await db.insert(schema.examQuestions).values({
    examId: draftExamId,
    question: 'Long questions stay supported.\n```js\nconst value = 1;\n```',
    type: 'multiple_choice',
    points: 1,
    order: 0,
  });
  await page.goto(`/exams/${draftExamId}`);
  await expect(page.getByRole('heading', { name: 'Delete exam' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete exam', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Type the exam title');
  await page.getByPlaceholder('Disposable Draft Exam').fill('Disposable Draft Exam');
  await page.getByRole('button', { name: 'Delete exam', exact: true }).click();
  await expect(page).toHaveURL(/\/exams$/);
  expect(
    (await db.select().from(schema.exams).where(eq(schema.exams.id, draftExamId))).length,
  ).toBe(0);
});
test('anonymous health, landing, missing Google configuration, and expired sessions', async ({
  page,
}) => {
  const r = await page.request.get('/api/health');
  expect(r.status()).toBe(200);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build your own university.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Google' }).first().click();
  await expect(page).toHaveURL(/error=Configuration/);
  await expect(page.locator('.alert.error')).toContainText('not configured');
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: 'invalid-session',
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
