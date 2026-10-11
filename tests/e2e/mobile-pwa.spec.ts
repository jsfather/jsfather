import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as schema from '../../src/db/schema';
config({ path: '.env.local', quiet: true });
const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client);
const userId = randomUUID(),
  token = randomUUID(),
  courseId = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db
    .insert(schema.users)
    .values({ id: userId, email: `${userId}@example.test`, name: 'Mobile Learner' });
  await db
    .insert(schema.authSessions)
    .values({ userId, sessionToken: token, expires: new Date(Date.now() + 3600000) });
  await db.insert(schema.courses).values({
    id: courseId,
    ownerId: userId,
    kind: 'vocabulary',
    title: 'A long vocabulary course title for phone layout checks',
    slug: 'mobile-vocab',
    category: 'English',
    difficulty: 'beginner',
    totalSessions: 0,
    scheduledTime: '09:00',
    duration: 30,
    timezone: 'Asia/Tehran',
    weekdays: [],
    startDate: '2026-10-11',
  });
  await db
    .insert(schema.vocabularyWords)
    .values({ courseId, word: 'Hello', explanation: 'A greeting', addedOn: '2026-10-11' });
});
test.afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  await client.end();
});
for (const width of [320, 390, 768, 1024]) {
  test(`pages fit ${width}px and mobile navigation stays aligned when scrolling`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await context.addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
    for (const path of [
      '/',
      '/practice',
      '/dashboard',
      '/courses',
      `/courses/${courseId}`,
      `/courses/${courseId}/edit`,
      `/courses/${courseId}/review`,
      '/courses/new',
      '/calendar?view=month',
      '/calendar?view=week',
      '/settings',
      '/profile',
      '/exams',
      '/exams/new',
      '/certificates',
    ]) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText('Application error');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path,
      ).toBe(true);
    }
    await page.goto('/dashboard');
    if (width === 390)
      await page.screenshot({ path: '/tmp/jsfather-mobile-dashboard.png', fullPage: true });
    await expect(page.getByText('Hey, you have 1 word to learn today.')).toBeVisible();
    if (width <= 760) {
      await page.evaluate(() => window.scrollTo(0, 500));
      expect((await page.locator('.mobile-header').boundingBox())!.y).toBe(0);
      const button = page.getByRole('button', { name: 'Toggle navigation' });
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('dialog', { name: 'University navigation' })).toBeVisible();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await expect(button).toBeFocused();
      await expect(page.locator('.sidebar')).toBeHidden();
      await button.click();
      await page.getByRole('link', { name: 'My courses', exact: true }).click();
      await expect(page).toHaveURL('/courses');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await button.click();
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(page.locator('.app-main')).not.toHaveAttribute('inert');
      await expect(page.locator('.sidebar')).not.toHaveAttribute('inert');
    }
  });
}
test('manifest, service worker, offline fallback, and authenticated push endpoints', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(
    true,
  );
  expect((await page.request.post('/api/push/subscription', { data: {} })).status()).toBe(401);
  expect((await page.request.post('/api/cron/vocabulary-reminders')).status()).toBe(401);
  await context.addCookies([
    { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Install & vocabulary reminders' })).toBeVisible();
  const configuration = await page.request.get('/api/push/config');
  if (
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT &&
    process.env.CRON_SECRET
  )
    expect(configuration.status()).toBe(200);
  if (configuration.ok()) {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-mobile-pwa',
      keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
    };
    expect(
      (
        await page.request.post('/api/push/subscription', {
          data: subscription,
          headers: { origin: base },
        })
      ).status(),
    ).toBe(204);
    expect((await (await page.request.get('/api/push/subscription')).json()).endpoints).toContain(
      subscription.endpoint,
    );
    expect(
      (
        await page.request.post('/api/push/subscription', {
          data: subscription,
          headers: { origin: 'https://untrusted.test' },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.delete('/api/push/subscription', {
          data: { endpoint: subscription.endpoint },
          headers: { origin: base },
        })
      ).status(),
    ).toBe(204);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'You’re offline' })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Try again' }).click();
  await expect(page).toHaveURL('/dashboard');
});

test('reminders count owned and joined courses and exclude mastered, future, archived, and inaccessible words', async ({
  page,
  context,
  browser,
}) => {
  const friend = randomUUID(),
    stranger = randomUUID();
  const friendToken = randomUUID(),
    strangerToken = randomUUID();
  const friendContext = await browser.newContext();
  const strangerContext = await browser.newContext();
  try {
    await db
      .insert(schema.users)
      .values([friend, stranger].map((id) => ({ id, email: `${id}@example.test` })));
    await db.insert(schema.authSessions).values([
      { userId: friend, sessionToken: friendToken, expires: new Date(Date.now() + 3600000) },
      { userId: stranger, sessionToken: strangerToken, expires: new Date(Date.now() + 3600000) },
    ]);
    await db.insert(schema.vocabularyMembers).values({ courseId, userId: friend });
    const words = await db
      .insert(schema.vocabularyWords)
      .values(
        ['due', 'future', 'mastered'].map((word) => ({
          courseId,
          word,
          explanation: word,
          addedOn: '2026-10-11',
          difficulty: 'easy' as const,
        })),
      )
      .returning();
    for (const id of [userId, friend])
      await db.insert(schema.vocabularyProgress).values(
        words.map((word) => ({
          wordId: word.id,
          userId: id,
          totalReviews: word.word === 'mastered' ? 5 : 1,
          successfulReviews: word.word === 'mastered' ? 5 : 1,
          dueAt: new Date(word.word === 'future' ? Date.now() + 86400000 : Date.now() - 86400000),
        })),
      );
    for (const [ctx, sessionToken] of [
      [context, token],
      [friendContext, friendToken],
      [strangerContext, strangerToken],
    ] as const)
      await ctx.addCookies([
        {
          name: 'authjs.session-token',
          value: sessionToken,
          url: base,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    await page.goto('/dashboard');
    await expect(
      page.getByText('Hey, you have 1 word to learn and 1 word to review today.'),
    ).toBeVisible();
    const friendPage = await friendContext.newPage();
    await friendPage.goto('/dashboard');
    await expect(
      friendPage.getByText('Hey, you have 1 word to learn and 1 word to review today.'),
    ).toBeVisible();
    const strangerPage = await strangerContext.newPage();
    await strangerPage.goto('/dashboard');
    await expect(strangerPage.locator('.vocabulary-reminder')).toHaveCount(0);
    await db
      .update(schema.courses)
      .set({ status: 'archived' })
      .where(eq(schema.courses.id, courseId));
    await friendPage.reload();
    await expect(friendPage.locator('.vocabulary-reminder')).toHaveCount(0);
  } finally {
    await db
      .update(schema.courses)
      .set({ status: 'active' })
      .where(eq(schema.courses.id, courseId));
    await friendContext.close();
    await strangerContext.close();
    for (const id of [friend, stranger])
      await db.delete(schema.users).where(eq(schema.users.id, id));
  }
});
