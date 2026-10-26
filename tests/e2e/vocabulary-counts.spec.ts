import { test, expect, type Locator } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const userId = randomUUID(),
  otherId = randomUUID(),
  token = randomUUID(),
  courseId = randomUUID(),
  wordId = randomUUID(),
  emptyId = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  for (const id of [userId, otherId])
    await db`insert into users(id,email,username) values(${id},${id + '@example.test'},${id})`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${token},${userId},now()+interval '1 hour')`;
  await db`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${courseId},${userId},'vocabulary','Word history counts',${courseId},'English','beginner',0,'09:00',30,'UTC','[]','2026-10-01')`;
  for (const [id, word] of [
    [wordId, 'Recall'],
    [emptyId, 'Unreviewed'],
  ])
    await db`insert into vocabulary_words(id,course_id,word,explanation,added_on) values(${id},${courseId},${word},'Bring an idea back to mind.','2026-10-01')`;
  // Another learner's results must never be included in the owner's word history.
  for (let index = 0; index < 9; index++) await review(otherId, true);
});
test.afterAll(async () => {
  await db`delete from users where id in (${userId},${otherId})`;
  await db.end();
});
async function review(learner: string, remembered: boolean | null) {
  const id = randomUUID();
  await db`insert into vocabulary_reviews(id,course_id,word_id,user_id,word_version,word_snapshot,direction,remembered,submitted_at)
    values(${id},${courseId},${wordId},${learner},1,${db.json({ word: 'Recall', explanation: 'Bring an idea back to mind.', example: '', difficulty: 'medium' })},'word',${remembered},${remembered === null ? null : new Date()})`;
  return id;
}
async function counts(container: Locator, shown: number, successful: number, failed: number) {
  const stats = container.getByRole('definition');
  await expect(stats).toHaveText([String(shown), String(successful), String(failed)]);
}
test('first and second appearances show only previous practice', async ({ page }) => {
  await db`delete from vocabulary_reviews where course_id=${courseId} and user_id=${userId}`;
  const firstId = await review(userId, null);
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  const card = page.getByRole('region', { name: 'Recall card', exact: true });
  await page.goto(`/courses/${courseId}/review/${firstId}`);
  await counts(card, 0, 0, 0);
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await counts(card, 0, 0, 0);
  await page.reload();
  await counts(card, 0, 0, 0);

  await db`update vocabulary_reviews set remembered=true, submitted_at=now() where id=${firstId}`;
  const secondId = await review(userId, null);
  await page.goto(`/courses/${courseId}/review/${secondId}`);
  await counts(card, 1, 1, 0);
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await counts(card, 1, 1, 0);
  await page.reload();
  await counts(card, 1, 1, 0);
});
for (const width of [1280, 320, 390]) {
  test(`personal showing and outcome counts at ${width}px`, async ({ page }) => {
    await db`delete from vocabulary_reviews where course_id=${courseId} and user_id=${userId}`;
    await db`delete from vocabulary_progress where user_id=${userId}`;
    for (const remembered of [true, false, true, false]) await review(userId, remembered);
    const pendingId = await review(userId, null);
    await page.setViewportSize({ width, height: 1000 });
    await page
      .context()
      .addCookies([
        { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
    await page.goto(`/courses/${courseId}`);
    const word = page
      .locator('.vocabulary-word')
      .filter({ has: page.getByRole('heading', { name: 'Recall', exact: true }) });
    const empty = page
      .locator('.vocabulary-word')
      .filter({ has: page.getByRole('heading', { name: 'Unreviewed', exact: true }) });
    await counts(word, 5, 2, 2);
    await counts(empty, 0, 0, 0);
    const valueTops = await word
      .locator('.vocabulary-review-counts dd')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().y));
    expect(Math.max(...valueTops) - Math.min(...valueTops)).toBeLessThan(1);
    // Historical results survive a progress reset; they are not inferred from mastery.
    await expect(word.locator('.vocabulary-word-progress')).toContainText(
      '0 / 10 successful reviews',
    );
    const progressBox = (await word.locator('.vocabulary-word-progress').boundingBox())!,
      statsBox = (await word.locator('.vocabulary-review-counts').boundingBox())!;
    expect(statsBox.y - progressBox.y - progressBox.height).toBeGreaterThanOrEqual(15.5);
    await word.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80));
    await page.screenshot({ path: test.info().outputPath('library-counts.png') });
    await page.goto(`/courses/${courseId}/review/${pendingId}`);
    const card = page.getByRole('region', { name: 'Recall card', exact: true });
    await counts(card, 4, 2, 2);
    await page.reload();
    await counts(card, 4, 2, 2);
    await page.screenshot({ path: test.info().outputPath('hidden-counts.png') });
    await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Answer', exact: true })).toBeVisible();
    await counts(card, 4, 2, 2);
    const stats = (await card.locator('.vocabulary-review-counts').boundingBox())!,
      dock = (await page
        .getByRole('complementary', { name: 'Vocabulary review actions' })
        .boundingBox())!;
    expect(stats.y + stats.height).toBeLessThanOrEqual(dock.y - 16);
    await page.screenshot({ path: test.info().outputPath('revealed-counts.png') });
    await page.getByRole('button', { name: 'Review again', exact: true }).click();
    await expect(page.locator('.vocabulary-prompt')).toHaveText('Unreviewed');
    await counts(card, 0, 0, 0);
    await page.goto(`/courses/${courseId}`);
    await counts(word, 5, 2, 3);
    await word.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80));
    await page.screenshot({ path: test.info().outputPath('failed-count-updated.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
