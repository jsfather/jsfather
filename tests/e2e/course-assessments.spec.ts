import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
config({ path: '.env.local' });
config();
const client = postgres(process.env.DATABASE_URL!, { max: 3 });
const db = drizzle(client);
const ownerId = randomUUID(),
  visitorId = randomUUID(),
  courseId = randomUUID();
const ownerToken = randomUUID(),
  visitorToken = randomUUID();
const sessionIds = [randomUUID(), randomUUID()],
  bankIds = [randomUUID(), randomUUID()];
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db.insert(schema.users).values([
    { id: ownerId, email: `${ownerId}@example.test`, name: 'Course Owner' },
    { id: visitorId, email: `${visitorId}@example.test`, name: 'Public Learner' },
  ]);
  await db.insert(schema.authSessions).values([
    { userId: ownerId, sessionToken: ownerToken, expires: new Date(Date.now() + 3600000) },
    { userId: visitorId, sessionToken: visitorToken, expires: new Date(Date.now() + 3600000) },
  ]);
  await db.insert(schema.courses).values({
    id: courseId,
    ownerId,
    title: 'Assessment flow course',
    slug: `assessment-${courseId}`,
    category: 'Testing',
    difficulty: 'beginner',
    totalSessions: 2,
    scheduledTime: '09:00',
    duration: 60,
    timezone: 'UTC',
    weekdays: [1],
    startDate: '2026-10-01',
  });
  for (let i = 0; i < 2; i++) {
    await db.insert(schema.courseSessions).values({
      id: sessionIds[i],
      courseId,
      title: `Class ${i + 1}`,
      sessionNumber: i + 1,
      scheduledDate: new Date(),
      duration: 60,
    });
    await db.insert(schema.exams).values({
      id: bankIds[i],
      courseId,
      sessionId: sessionIds[i],
      title: `Class ${i + 1} · Questions`,
    });
    for (let order = 0; order < (i === 0 ? 31 : 1); order++) {
      const id = randomUUID();
      await db.insert(schema.examQuestions).values({
        id,
        examId: bankIds[i],
        type: 'true_false',
        question: `Class ${i + 1} question ${order + 1}`,
        explanation: 'SECRET_KEY_BEFORE_SUBMISSION',
        order,
      });
      await db.insert(schema.examOptions).values([
        { questionId: id, text: 'True', isCorrect: true, order: 0 },
        { questionId: id, text: 'False', isCorrect: false, order: 1 },
      ]);
    }
  }
  await client.unsafe(await readFile('drizzle/0011_assessment_names.sql', 'utf8'));
});
test.afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, ownerId));
  await db.delete(schema.users).where(eq(schema.users.id, visitorId));
  await client.end();
});
async function passExam(page: Page) {
  expect(await page.content()).not.toContain('SECRET_KEY_BEFORE_SUBMISSION');
  for (let i = 0; i < 32; i++) {
    await page.getByRole('radio', { name: /True$/ }).check();
    if (i < 31) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Submit exam', exact: true }).click();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
}
test('course practice and final snapshots, certificates, publishing, and public learner records', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: ownerToken,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(`/courses/${courseId}`);
  await expect(page.getByRole('heading', { name: 'Course exams', exact: true })).toHaveCount(0);
  await expect(
    page.locator('.sidebar').getByRole('link', { name: 'Exams', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  const practiceId = page.url().split('/')[4];
  const [practice] = await db.select().from(schema.exams).where(eq(schema.exams.id, practiceId));
  expect(practice.isPractice).toBe(true);
  expect(practice.isFinal).toBe(false);
  expect(
    (
      await db
        .select()
        .from(schema.examQuestions)
        .where(eq(schema.examQuestions.examId, practiceId))
    ).length,
  ).toBe(32);
  await passExam(page);
  const certificates = () =>
    db.select().from(schema.certificates).where(eq(schema.certificates.userId, ownerId));
  expect((await certificates()).length).toBe(0);
  await page.goto(`/exams/${practiceId}`);
  await page.getByRole('button', { name: 'Start exam', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  await page.getByRole('button', { name: 'Submit exam', exact: true }).click();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page).toHaveURL(/\/results\//);
  await page.goto(`/courses/${courseId}`);
  await page.getByRole('button', { name: 'Final assessment', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  const finalId = page.url().split('/')[4];
  const finalAttemptId = page.url().split('/').at(-1)!;
  expect(
    (await db.select().from(schema.examQuestions).where(eq(schema.examQuestions.examId, finalId)))
      .length,
  ).toBe(32);
  await passExam(page);
  expect((await certificates()).length).toBe(0);
  for (const id of sessionIds) {
    await page.goto(`/sessions/${id}`);
    await page.getByRole('button', { name: 'Mark as completed', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reopen session', exact: true })).toBeVisible();
  }
  expect((await certificates()).length).toBe(1);
  expect(
    (
      await db
        .select()
        .from(schema.exams)
        .where(and(eq(schema.exams.courseId, courseId), eq(schema.exams.isFinal, true)))
    ).length,
  ).toBe(1);
  for (const id of [practiceId, finalId, bankIds[1]]) {
    await page.goto(`/exams/${id}`);
    await page.getByRole('button', { name: 'Enable public link', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Open public exam link', exact: true }),
    ).toBeVisible();
  }
  // Public practice of a final remains practice even for the course owner.
  await page.goto(`${base}/practice/${finalId}`);
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  await passExam(page);
  expect((await certificates()).length).toBe(1);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`${base}/practice?scope=course`);
  await expect(
    guest.getByText('Assessment flow course practice assessment', { exact: true }),
  ).toBeVisible();
  await expect(guest.getByText('Course exam', { exact: true })).toHaveCount(2);
  await expect(guest.getByText('Class 1 · Questions', { exact: true })).toHaveCount(0);
  await guest.setViewportSize({ width: 390, height: 844 });
  expect(
    await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await guest.goto(`${base}/practice?scope=session`);
  await expect(
    guest.getByText('Assessment flow course Class 2 practice assessment', { exact: true }),
  ).toBeVisible();
  await expect(guest.getByText('Session exam', { exact: true }).first()).toBeVisible();
  const attemptsBeforeGuest = (await db.select().from(schema.examAttempts)).length;
  await guest.goto(`${base}/practice/${bankIds[1]}`);
  await guest.getByRole('button', { name: 'Submit exam', exact: true }).click();
  await guest.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(guest.getByText('Your result has not been saved.', { exact: false })).toBeVisible();
  expect((await db.select().from(schema.examAttempts)).length).toBe(attemptsBeforeGuest);
  const visitorContext = await browser.newContext();
  await visitorContext.addCookies([
    {
      name: 'authjs.session-token',
      value: visitorToken,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const visitor = await visitorContext.newPage();
  await visitor.goto(`${base}/practice/${finalId}`);
  await expect(visitor.getByText('Course exam', { exact: true })).toBeVisible();
  await visitor.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(visitor).toHaveURL(/\/take\//);
  const visitorAttempt = visitor.url().split('/').at(-1)!;
  // Started snapshots remain usable after publication is disabled.
  await page.goto(`/exams/${finalId}`);
  await page.getByRole('button', { name: 'Disable public link', exact: true }).click();
  await passExam(visitor);
  const [saved] = await db
    .select()
    .from(schema.examAttempts)
    .where(eq(schema.examAttempts.id, visitorAttempt));
  expect(saved.userId).toBe(visitorId);
  expect(saved.percentage).toBe(100);
  expect(saved.snapshot?.practiceOnly).toBe(true);
  expect(
    (await db.select().from(schema.certificates).where(eq(schema.certificates.userId, visitorId)))
      .length,
  ).toBe(0);
  expect((await certificates()).length).toBe(1);
  await visitor.goto(`${base}/exams/${finalId}`);
  await expect(
    visitor.getByRole('button', { name: 'Enable public link', exact: true }),
  ).toHaveCount(0);
  await expect(visitor.getByRole('heading', { name: 'Delete exam', exact: true })).toHaveCount(0);
  expect((await visitor.goto(`${base}/exams/${finalId}/edit`))?.status()).toBe(404);
  expect((await visitor.goto(`${base}/exams/${finalId}/results/${finalAttemptId}`))?.status()).toBe(
    404,
  );
  expect((await guest.goto(`${base}/practice/${finalId}`))?.status()).toBe(404);
  await visitor.goto(`${base}/practice`);
  await expect(
    visitor.getByRole('heading', { name: 'Your practice history', exact: true }),
  ).toBeVisible();
  await visitor.getByRole('link', { name: 'View results', exact: true }).click();
  await expect(visitor.getByText('100%', { exact: true })).toBeVisible();
  await page.goto(`/courses/${courseId}/edit`);
  await page.getByLabel('Course name', { exact: true }).fill('Keyvan');
  await page.getByRole('button', { name: 'Save course', exact: true }).click();
  await expect(page.locator('.alert.success')).toContainText('Course updated');
  const renamed = await db.select().from(schema.exams).where(eq(schema.exams.courseId, courseId));
  expect(renamed.find((e) => e.id === finalId)?.title).toBe('Keyvan final assessment');
  expect(renamed.find((e) => e.id === practiceId)?.title).toBe('Keyvan practice assessment');
  expect(renamed.find((e) => e.id === bankIds[0])?.title).toBe(
    'Keyvan Class 1 practice assessment',
  );
  await page.goto(`/sessions/${sessionIds[0]}`);
  await page.getByLabel('Session title', { exact: true }).fill('Vocabulary');
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.locator('.alert.success')).toContainText('Session saved');
  expect(
    (await db.select().from(schema.exams).where(eq(schema.exams.id, bankIds[0])))[0].title,
  ).toBe('Keyvan Vocabulary practice assessment');
  await visitorContext.close();
  await guestContext.close();
});
