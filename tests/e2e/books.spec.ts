import { test, expect, type Page } from '@playwright/test';
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
const ownerId = randomUUID(),
  token = randomUUID(),
  username = `book-${randomUUID().slice(0, 8)}`;
const strangerId = randomUUID(),
  strangerToken = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db.insert(schema.users).values([
    {
      id: ownerId,
      email: `${ownerId}@example.test`,
      username,
      name: 'Book Reader',
      publicProfile: true,
      showCourses: true,
      publicProgress: true,
    },
    { id: strangerId, email: `${strangerId}@example.test`, name: 'Other Reader' },
  ]);
  await db.insert(schema.authSessions).values([
    { userId: ownerId, sessionToken: token, expires: new Date(Date.now() + 3600000) },
    { userId: strangerId, sessionToken: strangerToken, expires: new Date(Date.now() + 3600000) },
  ]);
});
test.afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, ownerId));
  await db.delete(schema.users).where(eq(schema.users.id, strangerId));
  await client.end();
});
async function passExam(page: Page) {
  await page.getByRole('radio', { name: /True$/ }).check();
  await page.getByRole('button', { name: 'Submit exam', exact: true }).click();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
}
test('read a book, save private notes and bookmarks, and take its practice and final exams', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  await page.goto('/courses/new');
  await page.getByRole('link', { name: 'Reading a book', exact: true }).click();
  await page.getByLabel('Book title', { exact: true }).fill('Backend book');
  await page.getByLabel('Author (optional)', { exact: true }).fill('Book Author');
  await page.getByLabel('Total pages', { exact: true }).fill('400');
  await page.getByLabel('Category', { exact: true }).selectOption('Backend');
  await page.getByLabel('Public course', { exact: true }).check();
  await page.getByRole('button', { name: 'Start book', exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);
  const id = page.url().split('/').at(-1)!;
  const currentBook = async () =>
    (await db.select().from(schema.courses).where(eq(schema.courses.id, id)))[0];
  expect((await currentBook()).kind).toBe('book');
  await page.getByLabel('Last page read', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(page.getByText('Reading progress saved.', { exact: true })).toBeVisible();
  await expect(page.getByText('25%', { exact: true })).toBeVisible();
  expect((await currentBook()).currentPage).toBe(100);
  await page.getByLabel('Last page read', { exact: true }).fill('401');
  await page.getByLabel('Last page read', { exact: true }).evaluate((input) => {
    (input as HTMLInputElement).form!.noValidate = true;
  });
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(
    page.getByText('Your reading position cannot exceed the book’s page count.', { exact: true }),
  ).toBeVisible();
  expect((await currentBook()).currentPage).toBe(100);

  await page.getByLabel('Reading notes', { exact: true }).fill('PRIVATE_BOOK_NOTES');
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(page.getByText('Reading notes saved.', { exact: true })).toBeVisible();
  await page.getByLabel('Bookmark page', { exact: true }).fill('150');
  await page.getByLabel('Bookmark label (optional)', { exact: true }).fill('Revisit architecture');
  await page
    .getByLabel('Bookmark notes (optional)', { exact: true })
    .fill('PRIVATE_BOOKMARK_NOTES');
  const captured = page.waitForRequest((request) => request.method() === 'POST');
  await page.getByRole('button', { name: 'Add bookmark', exact: true }).click();
  const request = await captured;
  await expect(page.getByText('Page 150 · Revisit architecture', { exact: true })).toBeVisible();
  const strangerContext = await browser.newContext();
  await strangerContext.addCookies([
    {
      name: 'authjs.session-token',
      value: strangerToken,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await strangerContext.request.post(request.url(), {
    headers: {
      'next-action': request.headers()['next-action'],
      'content-type': request.headers()['content-type'],
      origin: base,
    },
    data: request.postDataBuffer()!,
    maxRedirects: 0,
  });
  expect(
    await db.select().from(schema.bookBookmarks).where(eq(schema.bookBookmarks.courseId, id)),
  ).toHaveLength(1);
  const stranger = await strangerContext.newPage();
  expect((await stranger.goto(`/courses/${id}`))?.status()).toBe(404);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/u/${username}/courses/${(await currentBook()).slug}`);
  await expect(guest.getByText('100 / 400 pages read', { exact: false })).toBeVisible();
  expect(await guest.content()).not.toContain('PRIVATE_BOOK_NOTES');
  expect(await guest.content()).not.toContain('PRIVATE_BOOKMARK_NOTES');
  const bookmark = page.locator('details').filter({ hasText: 'Page 150 · Revisit architecture' });
  await bookmark.locator('summary').click();
  await bookmark
    .getByLabel('Bookmark label (optional)', { exact: true })
    .fill('Architecture notes');
  await bookmark.getByRole('button', { name: 'Save bookmark', exact: true }).click();
  await expect(page.getByText('Page 150 · Architecture notes', { exact: true })).toBeVisible();
  await page.goto(`/courses/${id}/edit`);
  await page.getByLabel('Total pages', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Save book', exact: true }).click();
  await expect(page.locator('.alert.error')).toContainText('existing bookmark');
  expect((await currentBook()).totalPages).toBe(400);
  await page.goto(`/courses/${id}`);
  await page.getByRole('link', { name: 'Manage questions', exact: true }).click();
  await page
    .getByLabel('Question text', { exact: true })
    .fill('The book discusses backend architecture.');
  await page.getByLabel('Question type').selectOption('true_false');
  await page.getByRole('button', { name: 'Save questions', exact: true }).click();
  await expect(page).toHaveURL(`/courses/${id}`);
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  await passExam(page);
  expect(
    await db.select().from(schema.certificates).where(eq(schema.certificates.courseId, id)),
  ).toHaveLength(0);
  await page.goto(`/courses/${id}`);
  await page.getByRole('button', { name: 'Final assessment', exact: true }).click();
  await expect(page).toHaveURL(/\/take\//);
  await passExam(page);
  expect(
    await db.select().from(schema.certificates).where(eq(schema.certificates.courseId, id)),
  ).toHaveLength(0);
  await page.goto(`/courses/${id}`);
  await page.getByLabel('Last page read', { exact: true }).fill('400');
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(page.getByText('Reading progress saved.', { exact: true })).toBeVisible();
  expect(
    await db.select().from(schema.certificates).where(eq(schema.certificates.courseId, id)),
  ).toHaveLength(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: test.info().outputPath('book-mobile.png'),
    animations: 'disabled',
  });
  const savedBookmark = page
    .locator('details')
    .filter({ hasText: 'Page 150 · Architecture notes' });
  await savedBookmark.locator('summary').click();
  await savedBookmark.getByRole('button', { name: 'Remove bookmark', exact: true }).click();
  await expect(page.getByText('Page 150 · Architecture notes', { exact: true })).toHaveCount(0);
  expect(
    await db.select().from(schema.bookBookmarks).where(eq(schema.bookBookmarks.courseId, id)),
  ).toHaveLength(0);

  await page.goto('/courses');
  await expect(page.locator('.course-card').filter({ hasText: 'Backend book' })).toContainText(
    '400 of 400 pages read',
  );
  await page.goto('/calendar');
  await expect(page.getByText('Book questions', { exact: true })).toHaveCount(0);
  await guestContext.close();
  await strangerContext.close();
});
