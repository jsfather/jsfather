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
const userId = randomUUID();
const ownerId = randomUUID();
const token = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const courseIds = Array.from({ length: 6 }, () => randomUUID());
const titles = [
  'My English',
  'Shared French',
  'Archived words',
  'Later words',
  'Mastered words',
  'Private words',
];

test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db.insert(schema.users).values([
    { id: userId, email: `${userId}@example.test`, name: 'Overview Learner', timezone: 'UTC' },
    { id: ownerId, email: `${ownerId}@example.test`, name: 'Overview Owner', timezone: 'UTC' },
  ]);
  await db.insert(schema.authSessions).values({
    userId,
    sessionToken: token,
    expires: new Date(Date.now() + 3600000),
  });
  await db.insert(schema.courses).values(
    courseIds.map((id, i) => ({
      id,
      ownerId: i === 1 || i === 5 ? ownerId : userId,
      kind: 'vocabulary' as const,
      title: titles[i],
      slug: id,
      category: 'Language',
      difficulty: 'beginner' as const,
      status: i === 2 ? ('archived' as const) : ('active' as const),
      totalSessions: 0,
      scheduledTime: '09:00',
      duration: 15,
      timezone: 'UTC',
      weekdays: [],
      startDate: '2026-10-13',
    })),
  );
  await db
    .insert(schema.vocabularyMembers)
    .values({ courseId: courseIds[1], userId, role: 'learner' });
  const words = await db
    .insert(schema.vocabularyWords)
    .values(
      courseIds.map((courseId) => ({
        courseId,
        word: 'Hello',
        explanation: 'A greeting',
        addedOn: '2026-10-13',
        difficulty: 'easy' as const,
      })),
    )
    .returning();
  await db.insert(schema.vocabularyProgress).values([
    {
      wordId: words[1].id,
      userId,
      totalReviews: 1,
      successfulReviews: 1,
      dueAt: new Date(Date.now() - 86400000),
    },
    {
      wordId: words[3].id,
      userId,
      totalReviews: 1,
      successfulReviews: 1,
      dueAt: new Date(Date.now() + 86400000),
    },
    {
      wordId: words[4].id,
      userId,
      totalReviews: 5,
      successfulReviews: 5,
      dueAt: new Date(Date.now() - 86400000),
    },
  ]);
});

test.afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  await db.delete(schema.users).where(eq(schema.users.id, ownerId));
  await client.end();
});

test('landing page offers login to guests and learning to signed-in users', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(page.getByRole('link', { name: 'My university', exact: true })).toHaveCount(0);
  await expect(page.getByText('How it works', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(2);
  await page.context().addCookies([{ name: 'authjs.session-token', value: token, url: base }]);
  await page.reload();
  await expect(page.getByRole('link', { name: 'My university', exact: true })).toHaveAttribute(
    'href',
    '/dashboard',
  );
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continue learning' })).toHaveCount(2);
  await page.screenshot({ path: '/tmp/jsfather-landing-updated.png', fullPage: true });
});

test('overview lists only available practice and opens the chosen course', async ({ page }) => {
  await page.context().addCookies([{ name: 'authjs.session-token', value: token, url: base }]);
  await page.goto('/dashboard');
  const panel = page.locator('.vocabulary-reminder');
  await expect(panel.getByRole('heading', { name: 'Today’s vocabulary' })).toBeVisible();
  await expect(panel.locator('.vocabulary-practice-item')).toHaveCount(2);
  await expect(panel).toContainText('1 word to learn');
  await expect(panel).toContainText('1 word to review');
  for (const title of titles.slice(2))
    await expect(panel.getByText(title, { exact: true })).toHaveCount(0);
  await expect(
    panel.getByRole('link', { name: 'Practice vocabulary: Shared French', exact: true }),
  ).toHaveAttribute('href', `/courses/${courseIds[1]}`);
  await page.screenshot({ path: '/tmp/jsfather-overview-updated.png', fullPage: true });
  await panel.getByRole('link', { name: 'Practice vocabulary: My English', exact: true }).click();
  await expect(page).toHaveURL(`${base}/courses/${courseIds[0]}`);
  await expect(page.getByRole('heading', { name: 'My English', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(
    panel.getByRole('link', { name: 'Practice vocabulary: My English', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/jsfather-overview-mobile.png', fullPage: true });
});

test('overview hides vocabulary practice when nothing is due', async ({ page }) => {
  await page.context().addCookies([{ name: 'authjs.session-token', value: token, url: base }]);
  await db
    .update(schema.courses)
    .set({ status: 'archived' })
    .where(eq(schema.courses.id, courseIds[0]));
  await db.delete(schema.vocabularyMembers).where(eq(schema.vocabularyMembers.userId, userId));
  try {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Today’s vocabulary' })).toHaveCount(0);
  } finally {
    await db
      .update(schema.courses)
      .set({ status: 'active' })
      .where(eq(schema.courses.id, courseIds[0]));
    await db
      .insert(schema.vocabularyMembers)
      .values({ courseId: courseIds[1], userId, role: 'learner' });
  }
});
