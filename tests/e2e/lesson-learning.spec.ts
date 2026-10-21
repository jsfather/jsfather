import { test, expect, type Locator } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { StudyNoteFiles } from '../../src/lib/study-note-files';
config({ path: '.env.local', quiet: true });
const files = new StudyNoteFiles();
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const userId = randomUUID(),
  token = randomUUID(),
  courseId = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  await db`insert into users(id,email,username,name) values(${userId},${userId + '@example.test'},${userId},'Lesson Reader')`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${token},${userId},now()+interval '1 hour')`;
  await db`insert into courses(id,owner_id,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${courseId},${userId},'Video learning',${courseId},'Backend','beginner',0,'09:00',30,'UTC','[]','2026-10-01')`;
});
test.afterAll(async () => {
  await files.removeCourse({ userId, courseId });
  await db`delete from users where id=${userId}`;
  await db.end();
});
async function gap(before: Locator, after: Locator) {
  const a = (await before.boundingBox())!,
    b = (await after.boundingBox())!;
  expect(b.y - a.y - a.height).toBeGreaterThanOrEqual(15.5);
}
for (const width of [1280, 320, 390]) {
  test(`chapters, bulk videos and private recall at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .context()
      .addCookies([
        { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
    await page.goto(`/courses/${courseId}`);
    const outline = page.getByRole('region', { name: 'Course chapters' });
    await expect(outline.getByRole('heading', { name: 'Chapters / folders' })).toBeVisible();
    if (width === 1280) {
      await expect(
        outline.getByText('No chapters yet. Create one for your first folder.'),
      ).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('course-empty.png'), fullPage: true });
    }
    await outline.getByText('Add a chapter', { exact: true }).click();
    await outline.getByLabel('New chapter title', { exact: true }).fill(`Foundations ${width}`);
    const chapterForm = outline
      .locator('form')
      .filter({ has: page.getByLabel('New chapter title', { exact: true }) });
    await gap(chapterForm.locator('.field-hint'), chapterForm.locator('.panel-actions'));
    await chapterForm.getByRole('button', { name: 'Add chapter', exact: true }).click();
    await expect(chapterForm.getByRole('status')).toContainText('Chapter added');
    await outline.getByRole('link', { name: new RegExp(`Foundations ${width}`) }).click();
    await outline.getByText('Edit chapter', { exact: true }).click();
    await outline.getByLabel('Chapter title', { exact: true }).fill(`Video folder ${width}`);
    await outline.getByRole('button', { name: 'Save chapter', exact: true }).click();
    await expect(page.getByRole('heading', { name: `Video folder ${width}` })).toBeVisible();
    await outline.getByText('Add videos to this chapter', { exact: true }).click();
    await outline
      .getByLabel('Video titles · one per line')
      .fill(`First video ${width}\nSecond video ${width}`);
    await outline.getByLabel('Default video duration (minutes)').fill('3');
    const bulk = outline
      .locator('form')
      .filter({ has: page.getByLabel('Video titles · one per line') });
    await gap(bulk.locator('.field-hint'), bulk.locator('.panel-actions'));
    await bulk.getByRole('button', { name: 'Add video lessons', exact: true }).click();
    await expect(bulk.getByRole('status')).toContainText('2 video lessons added');
    await expect(page.locator('.session-row')).toHaveCount(2);
    await page.screenshot({ path: test.info().outputPath('course-populated.png'), fullPage: true });
    await outline.screenshot({ path: test.info().outputPath('chapter-panel.png') });
    const [session] =
      await db`select * from course_sessions where course_id=${courseId} and title=${`First video ${width}`}`;
    await db`update course_sessions set notes='Use small functions with clear inputs.' where id=${session.id}`;
    await page.goto(`/sessions/${session.id}`);
    const review = page.getByRole('form', { name: 'Session review' });
    await expect(review.getByLabel('Key points I remember')).toBeVisible();
    const reveal = page.getByText('Reveal study notes & previous reviews', { exact: true });
    await reveal.click();
    await expect(page.getByText('No reviews yet. Save your first recall above.')).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('review-empty-revealed.png'),
      fullPage: true,
    });
    await expect(page.getByRole('region', { name: 'Session notes' })).toContainText(
      'Imported study notes',
    );
    expect(
      (await files.read({ userId, courseId, sessionId: session.id }, 'imported-study-notes.md'))
        ?.body,
    ).toContain('Use small functions with clear inputs.');
    await review.getByLabel('Key points I remember').fill('Small functions are easier to explain.');
    await review.getByLabel('Open questions').fill('How should errors cross a boundary?');
    await review.getByLabel('Understanding after this review').selectOption('revisit');
    await gap(review.locator('.field-hint'), review.locator('.panel-actions'));
    await review.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(review.getByRole('status')).toContainText('Review saved');
    await expect(page.locator('.lesson-review')).toHaveCount(1);
    await review.getByLabel('Key points I remember').fill('I can now explain error boundaries.');
    await review.getByLabel('Understanding after this review').selectOption('confident');
    await review.getByRole('button', { name: 'Save review', exact: true }).click();
    await expect(page.locator('.lesson-review')).toHaveCount(2);
    await page.screenshot({
      path: test.info().outputPath('review-feedback-populated.png'),
      fullPage: true,
    });
    const reviewPanel = page.getByRole('region', { name: 'Review this lesson' });
    await gap(
      reviewPanel.getByRole('heading', { name: 'Review this lesson', exact: true }),
      reviewPanel.locator(':scope > p'),
    );
    await reviewPanel.screenshot({ path: test.info().outputPath('review-panel.png') });
    const sessionForm = page
      .locator('form')
      .filter({ has: page.getByLabel('Session title', { exact: true }) });
    const formBox = (await sessionForm.boundingBox())!,
      actionsBox = (await sessionForm.locator('.panel-actions').boundingBox())!;
    expect(formBox.y + formBox.height - actionsBox.y - actionsBox.height).toBeGreaterThanOrEqual(
      16,
    );
    expect(formBox.y + formBox.height - actionsBox.y - actionsBox.height).toBeLessThanOrEqual(33);
    const [stored] = await db`select * from course_sessions where id=${session.id}`;
    expect(stored.notes).toBe('');
    expect(stored.status).toBe('upcoming');
    const saved = await db`select * from session_reviews where session_id=${session.id}`;
    expect(saved).toHaveLength(2);
    expect(saved[0].questions).toBe('How should errors cross a boundary?');
    // Existing lessons can move out of a chapter without losing notes or reviews.
    await page.getByLabel('Chapter / folder').selectOption('');
    await page.getByRole('button', { name: 'Save session', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Session saved' })).toBeVisible();
    await expect
      .poll(
        async () =>
          (await db`select chapter_id from course_sessions where id=${session.id}`)[0].chapter_id,
      )
      .toBeNull();
    await page.goto(`/courses/${courseId}?chapter=ungrouped`);
    await expect(
      page.locator('.session-row').filter({ hasText: `First video ${width}` }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('chapter pagination preserves the filter and database rejects foreign-course chapters', async ({
  page,
}) => {
  const chapterId = randomUUID(),
    otherId = randomUUID();
  await db`insert into course_chapters(id,course_id,title,position) values(${chapterId},${courseId},'Large folder',99)`;
  await db`insert into course_sessions(id,course_id,chapter_id,title,session_number,scheduled_date,duration)
    select ${courseId} || '-bulk-' || n,${courseId},${chapterId},'Bulk video ' || n,100+n,now(),30 from generate_series(1,55) n`;
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  await page.goto(`/courses/${courseId}?chapter=${chapterId}`);
  await expect(page.locator('.session-row')).toHaveCount(50);
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`chapter=${chapterId}&page=2`));
  await expect(page.locator('.session-row')).toHaveCount(5);
  await db`insert into courses(id,owner_id,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${otherId},${userId},'Other course',${otherId},'Backend','beginner',0,'09:00',30,'UTC','[]','2026-10-01')`;
  await expect(db`insert into course_sessions(id,course_id,chapter_id,title,session_number,scheduled_date,duration)
    values(${randomUUID()},${otherId},${chapterId},'Invalid',1,now(),30)`).rejects.toMatchObject({
    code: '23503',
  });
  await page.context().clearCookies();
  await page.goto(`/sessions/${courseId}-bulk-1`);
  await expect(page).toHaveURL(/\/login/);
});
