import { test, expect, type BrowserContext, type Page, type Request } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as schema from '../../src/db/schema';
config({ path: '.env.local' });
config();
const client = postgres(process.env.DATABASE_URL!, { max: 4 });
const db = drizzle(client);
const ownerId = randomUUID(),
  friendId = randomUUID(),
  strangerId = randomUUID();
const ownerToken = randomUUID(),
  friendToken = randomUUID(),
  strangerToken = randomUUID();
const friendUsername = `friend-${friendId.slice(0, 8)}`;
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
let courseId = '';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db.insert(schema.users).values([
    { id: ownerId, email: `${ownerId}@example.test`, name: 'Vocabulary Owner', timezone: 'UTC' },
    {
      id: friendId,
      email: `${friendId}@example.test`,
      name: 'Vocabulary Friend',
      username: friendUsername,
      timezone: 'UTC',
    },
    { id: strangerId, email: `${strangerId}@example.test`, name: 'Other Learner', timezone: 'UTC' },
  ]);
  await db.insert(schema.authSessions).values([
    { userId: ownerId, sessionToken: ownerToken, expires: new Date(Date.now() + 3600000) },
    { userId: friendId, sessionToken: friendToken, expires: new Date(Date.now() + 3600000) },
    { userId: strangerId, sessionToken: strangerToken, expires: new Date(Date.now() + 3600000) },
  ]);
});
test.afterAll(async () => {
  for (const id of [ownerId, friendId, strangerId])
    await db.delete(schema.users).where(eq(schema.users.id, id));
  await client.end();
});
async function login(context: BrowserContext, token: string) {
  await context.addCookies([
    { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
}
function actionRequest(page: Page) {
  return page.waitForRequest((r) => r.method() === 'POST', { timeout: 10000 });
}
async function replay(context: BrowserContext, req: Request) {
  return context.request.post(req.url(), {
    headers: {
      ...(req.headers()['next-action'] ? { 'next-action': req.headers()['next-action'] } : {}),
      'content-type': req.headers()['content-type'],
      origin: base,
    },
    data: req.postDataBuffer()!,
    maxRedirects: 0,
  });
}
test('daily vocabulary, collaborator isolation, spaced practice, mastery, edits, and revocation', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  await login(page.context(), ownerToken);
  const friendContext = await browser.newContext();
  await login(friendContext, friendToken);
  const friend = await friendContext.newPage();
  const strangerContext = await browser.newContext();
  await login(strangerContext, strangerToken);
  const stranger = await strangerContext.newPage();
  try {
    await page.goto('/courses/new');
    await page.getByRole('link', { name: 'Language vocabulary', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Language vocabulary course', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Course name', { exact: true }).fill('Everyday English');
    await page.getByLabel('Language', { exact: true }).fill('English');
    await page.getByRole('button', { name: 'Create vocabulary course' }).click();
    await expect(
      page.getByRole('heading', { name: 'Everyday English', exact: true }),
    ).toBeVisible();
    courseId = page.url().split('/').at(-1)!;
    const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, courseId));
    expect(course.kind).toBe('vocabulary');
    expect(course.totalSessions).toBe(0);
    expect(
      await db
        .select()
        .from(schema.courseSessions)
        .where(eq(schema.courseSessions.courseId, courseId)),
    ).toHaveLength(0);
    const addForm = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Add today’s words' }) });
    async function add(word: string, difficulty: string) {
      await addForm.getByLabel('Word or phrase').fill(word);
      await addForm.getByLabel('Meaning / explanation').fill(`Meaning of ${word}`);
      await addForm.getByLabel('Difficulty').selectOption(difficulty);
      const request = actionRequest(page);
      await addForm.getByRole('button', { name: 'Add word', exact: true }).click();
      await expect(page.getByRole('heading', { name: word, exact: true })).toBeVisible();
      return await request;
    }
    const addRequest = await add('Hello', 'easy');
    await replay(strangerContext, addRequest);
    expect(
      await db
        .select()
        .from(schema.vocabularyWords)
        .where(eq(schema.vocabularyWords.courseId, courseId)),
    ).toHaveLength(1);
    await addForm.getByLabel('Word or phrase').fill(' hello ');
    await addForm.getByLabel('Meaning / explanation').fill('Duplicate');
    await addForm.getByRole('button', { name: 'Add word', exact: true }).click();
    await expect(addForm.locator('.alert.error')).toContainText('already');
    await page.getByLabel('Collaborator username').fill(friendUsername);
    await page.getByRole('button', { name: 'Add collaborator' }).click();
    await expect(
      page.locator('.alert.success').filter({ hasText: 'Collaborator added' }),
    ).toBeVisible();
    await friend.goto('/courses');
    await expect(friend.getByRole('heading', { name: 'Everyday English' })).toBeVisible();
    await friend.getByRole('link', { name: /Everyday English/ }).click();
    await expect(friend.getByRole('heading', { name: 'Add today’s words' })).toHaveCount(0);
    await expect(friend.getByRole('link', { name: 'Edit course' })).toHaveCount(0);
    await replay(friendContext, addRequest);
    expect(
      await db
        .select()
        .from(schema.vocabularyWords)
        .where(eq(schema.vocabularyWords.courseId, courseId)),
    ).toHaveLength(1);
    expect((await stranger.goto(`/courses/${courseId}`))?.status()).toBe(404);
    expect((await friend.goto(`/courses/${courseId}/edit`))?.status()).toBe(404);
    await friend.goto(`/courses/${courseId}`);
    await friend.getByRole('button', { name: 'Practice', exact: true }).click();
    await expect(friend).toHaveURL(new RegExp(`/courses/${courseId}/review/[a-z0-9-]+$`));
    const firstReviewUrl = friend.url();
    const friendTab = await friendContext.newPage();
    await friendTab.goto(`/courses/${courseId}`);
    await friendTab.getByRole('button', { name: 'Practice', exact: true }).click();
    await expect(friendTab).toHaveURL(firstReviewUrl);
    await friendTab.close();
    expect((await stranger.goto(firstReviewUrl))?.status()).toBe(404);
    await expect(friend.getByRole('button', { name: 'Remembered', exact: true })).toHaveCount(0);
    await friend.getByRole('button', { name: 'Reveal answer' }).click();
    await friend.screenshot({
      path: test.info().outputPath('vocabulary-review.png'),
      fullPage: true,
    });
    await friend.getByRole('button', { name: 'Review again', exact: true }).click();
    await expect(
      friend.getByRole('heading', { name: 'You’re caught up', exact: true }),
    ).toBeVisible();
    const [hello] = await db
      .select()
      .from(schema.vocabularyWords)
      .where(eq(schema.vocabularyWords.courseId, courseId));
    const progress = async () =>
      (
        await db
          .select()
          .from(schema.vocabularyProgress)
          .where(
            and(
              eq(schema.vocabularyProgress.wordId, hello.id),
              eq(schema.vocabularyProgress.userId, friendId),
            ),
          )
      )[0];
    expect((await progress()).successfulReviews).toBe(0);
    expect((await progress()).totalReviews).toBe(1);
    expect((await progress()).dueAt.getTime() - Date.now()).toBeGreaterThan(9 * 60000);
    await db
      .update(schema.vocabularyProgress)
      .set({ dueAt: new Date(Date.now() - 60000) })
      .where(eq(schema.vocabularyProgress.wordId, hello.id));
    await friend.goto(`/courses/${courseId}`);
    await friend.getByRole('button', { name: 'Practice', exact: true }).click();
    await friend.getByRole('button', { name: 'Reveal answer' }).click();
    const submitRequest = actionRequest(friend);
    await friend.getByRole('button', { name: 'Remembered', exact: true }).click();
    await expect(
      friend.getByRole('heading', { name: 'You’re caught up', exact: true }),
    ).toBeVisible();
    const submitted = await submitRequest;
    await replay(friendContext, submitted);
    await replay(strangerContext, submitted);
    expect((await progress()).successfulReviews).toBe(1);
    expect((await progress()).totalReviews).toBe(2);
    expect((await progress()).dueAt.getTime() - Date.now()).toBeGreaterThan(47 * 3600000);
    expect(
      await db
        .select()
        .from(schema.vocabularyProgress)
        .where(eq(schema.vocabularyProgress.userId, ownerId)),
    ).toHaveLength(0);
    await page.goto(`/courses/${courseId}`);
    await add('Travel', 'medium');
    await add('Serendipity', 'hard');
    await page.screenshot({
      path: test.info().outputPath('vocabulary-course-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect
      .poll(async () => {
        const box = await page.locator('.sidebar').boundingBox();
        return box ? box.x + box.width : 0;
      })
      .toBeLessThanOrEqual(0);
    await page.screenshot({
      path: test.info().outputPath('vocabulary-course-mobile.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    const words = await db
      .select()
      .from(schema.vocabularyWords)
      .where(eq(schema.vocabularyWords.courseId, courseId));
    for (const word of words) {
      const success = { easy: 4, medium: 9, hard: 14 }[word.difficulty];
      await db
        .insert(schema.vocabularyProgress)
        .values({
          wordId: word.id,
          userId: friendId,
          successfulReviews: success,
          totalReviews: success,
          dueAt: new Date(Date.now() - 60000),
        })
        .onConflictDoUpdate({
          target: [schema.vocabularyProgress.wordId, schema.vocabularyProgress.userId],
          set: {
            successfulReviews: success,
            totalReviews: success,
            dueAt: new Date(Date.now() - 60000),
          },
        });
    }
    await friend.goto(`/courses/${courseId}`);
    await friend.getByRole('button', { name: 'Practice', exact: true }).click();
    for (let i = 0; i < 3; i++) {
      await friend.getByRole('button', { name: 'Reveal answer' }).click();
      await friend.getByRole('button', { name: 'Remembered', exact: true }).click();
    }
    await expect(
      friend.getByRole('heading', { name: 'You’re caught up', exact: true }),
    ).toBeVisible();
    await expect(friend.getByText('3 of 3 words mastered.', { exact: false })).toBeVisible();
    const mastered = await db
      .select()
      .from(schema.vocabularyProgress)
      .where(eq(schema.vocabularyProgress.userId, friendId));
    expect(mastered.map((p) => p.successfulReviews).sort((a, b) => a - b)).toEqual([5, 10, 15]);
    await friend.goto('/courses');
    await expect(friend.getByRole('link', { name: /Everyday English/ })).toContainText(
      '3 of 3 words mastered',
    );
    await page.goto(`/courses/${courseId}`);
    const helloCard = page
      .locator('.vocabulary-word')
      .filter({ has: page.getByRole('heading', { name: 'Hello', exact: true }) });
    await helloCard.getByText('Edit or delete word', { exact: true }).click();
    await page.screenshot({
      path: test.info().outputPath('vocabulary-editor-desktop.png'),
      fullPage: true,
    });
    await helloCard.getByLabel('Meaning / explanation').fill('A greeting');
    await helloCard.getByRole('button', { name: 'Save word', exact: true }).click();
    await expect(helloCard.locator('.alert.success')).toContainText('Word updated');
    expect(await progress()).toBeUndefined();
    expect(
      await db
        .select()
        .from(schema.vocabularyReviews)
        .where(
          and(
            eq(schema.vocabularyReviews.wordId, hello.id),
            sql`${schema.vocabularyReviews.submittedAt} is not null`,
          ),
        ),
    ).toHaveLength(3);
    await friend.goto(`/courses/${courseId}`);
    await friend.getByRole('button', { name: 'Practice', exact: true }).click();
    await expect(friend).toHaveURL(new RegExp(`/courses/${courseId}/review/[a-z0-9-]+$`));
    const revokedReview = friend.url();
    await friend.getByRole('button', { name: 'Reveal answer' }).click();
    const member = page.locator('.vocabulary-member');
    await member.locator('summary').click();
    await member.getByRole('button', { name: 'Remove collaborator' }).click();
    await page.getByLabel('Username to confirm removal').fill('wrong');
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }),
    ).toBeDisabled();
    await page.getByLabel('Username to confirm removal').fill(friendUsername);
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.locator('.vocabulary-member')).toHaveCount(0);
    await friend.getByRole('button', { name: 'Remembered', exact: true }).click();
    expect(await progress()).toBeUndefined();
    expect((await friend.goto(revokedReview))?.status()).toBe(404);
    await friend.goto('/courses');
    await expect(
      friend.getByRole('heading', { name: 'Everyday English', exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('Collaborator username').fill(friendUsername);
    await page.getByRole('button', { name: 'Add collaborator' }).click();
    await expect(page.locator('.vocabulary-member')).toHaveCount(1);
    await friend.goto(`/courses/${courseId}`);
    await expect(friend.getByText('2 of 3 words mastered', { exact: true })).toBeVisible();
    await friend.getByRole('button', { name: 'Leave course', exact: true }).click();
    await friend.getByLabel('Course title to confirm leaving').fill('Everyday English');
    await friend.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(friend).toHaveURL('/courses');
    expect(
      await db
        .select()
        .from(schema.vocabularyMembers)
        .where(eq(schema.vocabularyMembers.courseId, courseId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.vocabularyProgress)
        .where(eq(schema.vocabularyProgress.userId, friendId)),
    ).toHaveLength(2);
    await helloCard.getByRole('button', { name: 'Delete word' }).click();
    await page.getByLabel('Word to confirm deletion').fill('wrong');
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }),
    ).toBeDisabled();
    await page.getByLabel('Word to confirm deletion').fill('Hello');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Hello', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Edit course', exact: true }).click();
    await page.getByLabel('Course name', { exact: true }).fill('English with friends');
    await page.getByRole('button', { name: 'Save course', exact: true }).click();
    await expect(page.locator('.alert.success')).toContainText('Course updated');
    await expect(page.getByLabel('Number of sessions')).toHaveCount(0);
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'English with friends', exact: true }),
    ).toBeVisible();
    await page.goto(`/courses/${courseId}/edit`);
    await page.getByRole('button', { name: 'Delete course', exact: true }).click();
    await page.getByLabel('Course title to confirm deletion').fill('English with friends');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page).toHaveURL('/courses');
    expect(
      await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.vocabularyWords)
        .where(eq(schema.vocabularyWords.courseId, courseId)),
    ).toHaveLength(0);
  } finally {
    await friendContext.close();
    await strangerContext.close();
  }
});
