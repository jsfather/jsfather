import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as schema from '../../src/db/schema';
config({ path: '.env.local' });
config();
const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client);
const userId = randomUUID(),
  courseId = randomUUID(),
  token = randomUUID();
const firstId = randomUUID(),
  secondId = randomUUID(),
  examId = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db
    .insert(schema.users)
    .values({ id: userId, email: `${userId}@example.test`, name: 'Session Manager' });
  await db
    .insert(schema.authSessions)
    .values({ userId, sessionToken: token, expires: new Date(Date.now() + 3600000) });
  await db.insert(schema.courses).values({
    id: courseId,
    ownerId: userId,
    title: 'Session management course',
    slug: `sessions-${courseId}`,
    category: 'Testing',
    difficulty: 'beginner',
    totalSessions: 2,
    scheduledTime: '09:00',
    duration: 60,
    timezone: 'UTC',
    weekdays: [1],
    startDate: '2026-10-01',
    endDate: '2026-10-08',
  });
  await db.insert(schema.courseSessions).values([
    {
      id: firstId,
      courseId,
      title: 'First session',
      sessionNumber: 1,
      scheduledDate: new Date('2026-10-01T09:00:00Z'),
      duration: 60,
    },
    {
      id: secondId,
      courseId,
      title: 'Second session',
      sessionNumber: 2,
      scheduledDate: new Date('2026-10-08T09:00:00Z'),
      duration: 60,
    },
  ]);
  await db.insert(schema.exams).values({
    id: examId,
    courseId,
    sessionId: firstId,
    title: 'Session management course First session practice assessment',
  });
  await db
    .insert(schema.examQuestions)
    .values({ examId, question: 'True?', type: 'true_false', order: 0 });
});
test.afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  await client.end();
});
test('manage the attached exam and add, edit, remove, and restore sessions', async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  await page.goto(`/courses/${courseId}`);
  await expect(page.locator('.sidebar').getByRole('link', { name: 'Explore exams' })).toHaveCount(
    0,
  );
  await expect(page.locator('.session-row').filter({ hasText: 'First session' })).toContainText(
    '1 question',
  );
  await expect(page.locator('.session-row').filter({ hasText: 'Second session' })).toContainText(
    '0 questions',
  );
  await page.goto(`/sessions/${firstId}`);
  const examPanel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Assessment', exact: true }) });
  await expect(examPanel.getByRole('button', { name: 'Practice', exact: true })).toBeVisible();
  await expect(examPanel.getByRole('button')).toHaveCount(1);
  await expect(examPanel.getByText('Add questions', { exact: true })).toHaveCount(0);
  await examPanel.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/exams/${examId}/take/`));
  const attempts = await db
    .select()
    .from(schema.examAttempts)
    .where(eq(schema.examAttempts.examId, examId));
  expect(attempts).toHaveLength(1);
  expect(attempts[0].snapshot?.practiceOnly).toBe(true);
  await page.goto(`/sessions/${firstId}`);
  await examPanel.getByRole('link', { name: 'Results, sharing & edit exam' }).click();
  await page.getByRole('link', { name: 'Edit questions' }).click();
  await expect(page).toHaveURL(`/exams/${examId}/edit`);
  await page.getByRole('button', { name: 'Add question', exact: true }).click();
  await page.getByRole('button', { name: 'Remove question 2', exact: true }).click();
  await page.getByLabel('Confirmation text', { exact: true }).fill('Question 2');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Question 2', exact: true })).toHaveCount(0);
  expect(
    await db.select().from(schema.examQuestions).where(eq(schema.examQuestions.examId, examId)),
  ).toHaveLength(1);
  await page.goto(`/sessions/${firstId}`);
  await page.getByRole('button', { name: 'Delete exam', exact: true }).click();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy confirmation text' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('Session management course First session practice assessment');
  await page.screenshot({ path: test.info().outputPath('delete-dialog-desktop.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete exam', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Delete exam', exact: true }).click();
  await page.getByLabel('Exam title to confirm deletion').fill('wrong title');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Exam title to confirm deletion')
    .fill('Session management course First session practice assessment');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Add exam', exact: true })).toBeVisible();
  expect((await db.select().from(schema.exams).where(eq(schema.exams.id, examId))).length).toBe(0);
  await page.getByLabel('Session title', { exact: true }).fill('Updated session');
  await page.getByLabel('Scheduled date · UTC').fill('2026-12-15');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Session saved');
  const currentCourse = async () =>
    (await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)))[0];
  expect((await currentCourse()).endDate).toBe('2026-12-15');
  expect((await currentCourse()).totalSessions).toBe(2);
  await page.goto(`/courses/${courseId}`);
  await page.getByRole('link', { name: 'Add session', exact: true }).click();
  await page.getByLabel('Session title', { exact: true }).fill('Third session');
  await page.getByLabel('Scheduled date · UTC').fill('2026-12-31');
  await page.getByRole('button', { name: 'Add session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Third session', exact: true })).toBeVisible();
  const thirdId = page.url().split('/').at(-1)!;
  expect((await currentCourse()).totalSessions).toBe(3);
  expect((await currentCourse()).endDate).toBe('2026-12-31');
  for (const [id, remaining] of [
    [secondId, 2],
    [firstId, 1],
    [thirdId, 0],
  ] as const) {
    await page.goto(`/sessions/${id}`);
    const sessionTitle = await page.getByLabel('Session title', { exact: true }).inputValue();
    await page.getByRole('button', { name: 'Remove session', exact: true }).click();
    await page.getByLabel('Session title to confirm deletion').fill('wrong title');
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }),
    ).toBeDisabled();
    expect((await currentCourse()).totalSessions).toBe(remaining + 1);
    await page.getByLabel('Session title to confirm deletion').fill(sessionTitle);
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page).toHaveURL(`/courses/${courseId}`);
    expect((await currentCourse()).totalSessions).toBe(remaining);
  }
  expect((await currentCourse()).endDate).toBeNull();
  await expect(
    page.getByText('No sessions yet. Add a session to continue your course.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Edit course', exact: true }).click();
  await expect(page.getByLabel('Number of sessions')).toHaveCount(0);
  await expect(page.getByLabel('Add a schedule', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Save course', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Course updated');
  await page.goto(`/courses/${courseId}`);
  await page.getByRole('link', { name: 'Add session', exact: true }).click();
  await page.getByLabel('Session title', { exact: true }).fill('Fresh session');
  await page.getByRole('button', { name: 'Add session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fresh session', exact: true })).toBeVisible();
  expect((await currentCourse()).totalSessions).toBe(1);
  expect(
    (
      await db
        .select()
        .from(schema.courseSessions)
        .where(eq(schema.courseSessions.courseId, courseId))
    )[0].sessionNumber,
  ).toBe(1);
});
