import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const owner = randomUUID(),
  courseId = randomUUID(),
  longCourseId = randomUUID();
const shortReview = randomUUID(),
  longReview = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  await db`insert into users(id,email,username) values(${owner},${owner + '@example.test'},${'layout-' + owner.slice(0, 8)})`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${owner},${owner},now()+interval '1 hour')`;
  for (const [reviewId, explanation] of [
    [shortReview, 'A short answer.'],
    [longReview, 'An explanation with several details worth reviewing. '.repeat(80)],
  ]) {
    const targetCourseId = reviewId === longReview ? longCourseId : courseId;
    await db`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${targetCourseId},${owner},'vocabulary','Stable vocabulary controls',${targetCourseId},'English','intermediate',0,'00:00',15,'UTC','[]','2026-10-14')`;
    const wordId = randomUUID();
    await db`insert into vocabulary_words(id,course_id,word,explanation,example,added_on)
      values(${wordId},${targetCourseId},'Recall',${explanation},${'An example sentence. '.repeat(40)},'2026-10-14')`;
    await db`insert into vocabulary_reviews(id,course_id,word_id,user_id,word_version,word_snapshot,direction)
      values(${reviewId},${targetCourseId},${wordId},${owner},1,${db.json({ word: 'Recall', explanation, example: '', difficulty: 'medium' })},'word')`;
  }
});
test.afterAll(async () => {
  await db`delete from users where id=${owner}`;
  await db.end();
});
test('review controls stay reachable and stable across answer lengths and scrolling', async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: owner, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    let shortPosition: { x: number; y: number; width: number; height: number } | null = null;
    for (const reviewId of [shortReview, longReview]) {
      await db`update vocabulary_reviews set revealed_at=null where id=${reviewId}`;
      await page.goto(
        `/courses/${reviewId === longReview ? longCourseId : courseId}/review/${reviewId}`,
      );
      const reveal = page.getByRole('button', { name: 'Reveal answer', exact: true });
      const revealPosition = (await reveal.count()) ? await reveal.boundingBox() : null;
      if (await reveal.count()) {
        await page.screenshot({
          path: test
            .info()
            .outputPath(
              `question-${viewport.width}-${reviewId === longReview ? 'long' : 'short'}.png`,
            ),
        });
        await reveal.click();
      }
      const again = page.getByRole('button', { name: 'Review again', exact: true });
      const remembered = page.getByRole('button', { name: 'Remembered', exact: true });
      await expect(again).toBeFocused();
      const position = (await again.boundingBox())!;
      const otherPosition = (await remembered.boundingBox())!;
      expect(position.height).toBeGreaterThanOrEqual(48);
      expect(position.y + position.height).toBeLessThanOrEqual(viewport.height);
      expect(Math.abs(position.width - otherPosition.width)).toBeLessThan(1);
      expect(Math.abs(position.y - otherPosition.y)).toBeLessThan(1);
      if (revealPosition) expect(Math.abs(position.y - revealPosition.y)).toBeLessThan(1);
      if (shortPosition) expect(Math.abs(position.y - shortPosition.y)).toBeLessThan(1);
      else shortPosition = position;
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      expect(Math.abs((await again.boundingBox())!.y - position.y)).toBeLessThan(1);
      const backLink = (await page
        .getByRole('link', { name: 'Back to course', exact: true })
        .boundingBox())!;
      const dock = (await page
        .getByRole('complementary', { name: 'Vocabulary review actions' })
        .boundingBox())!;
      expect(backLink.y + backLink.height).toBeLessThanOrEqual(dock.y);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const card = (await page
        .getByRole('region', { name: 'Recall card', exact: true })
        .boundingBox())!;
      const answer = (await page
        .getByRole('region', { name: 'Answer', exact: true })
        .boundingBox())!;
      expect(card.y).toBeGreaterThan(0);
      expect(answer.height).toBeGreaterThan(80);
      expect(answer.y + answer.height).toBeLessThanOrEqual(dock.y - 16);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const prompt = (await page.locator('.vocabulary-review-action-prompt').boundingBox())!;
      expect(position.y - prompt.y - prompt.height).toBeGreaterThanOrEqual(16);
      await page.screenshot({
        path: test
          .info()
          .outputPath(`review-${viewport.width}-${reviewId === longReview ? 'long' : 'short'}.png`),
        animations: 'disabled',
      });
      await page.keyboard.press('Tab');
      await expect(remembered).toBeFocused();
    }
  }
});

test('practice modes persist across ratings and reloads and prioritize the Persian meaning', async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: owner, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  await db`update vocabulary_words set persian_meaning='یادآوری' where course_id=${courseId}`;
  const secondWord = randomUUID();
  await db`insert into vocabulary_words(id,course_id,word,explanation,persian_meaning,added_on)
    values(${secondWord},${courseId},'Learn','To gain knowledge','یاد گرفتن','2026-10-14')`;
  await page.goto(`/courses/${courseId}/review/${shortReview}`);
  const mode = page.getByRole('combobox', { name: 'Practice mode', exact: true });
  await expect(mode).toHaveValue('word');
  async function apply(value: string) {
    await mode.selectOption(value);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Practice mode saved');
    await expect(page.getByRole('button', { name: 'Reveal answer', exact: true })).toBeVisible();
  }
  await apply('meaning');
  await expect(page.locator('.vocabulary-prompt')).toHaveText('یادآوری');
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Answer', exact: true }).getByRole('heading'),
  ).toHaveText('Recall');
  await page.reload();
  await expect(mode).toHaveValue('meaning');
  await page.getByRole('button', { name: 'Remembered', exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(shortReview));
  await expect(mode).toHaveValue('meaning');
  await expect(page.locator('.vocabulary-prompt')).toHaveText('یاد گرفتن');
  await apply('word');
  await expect(page.locator('.vocabulary-prompt')).toHaveText('Learn');
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Answer', exact: true }).getByRole('heading'),
  ).toHaveText('یاد گرفتن');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 900 });
    const answer = page.getByRole('region', { name: 'Answer', exact: true });
    const primaryAnswer = (await answer.getByRole('heading').boundingBox())!;
    const answerBox = (await answer.boundingBox())!;
    expect(primaryAnswer.y + primaryAnswer.height).toBeLessThanOrEqual(
      answerBox.y + answerBox.height,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`persian-answer-${width}.png`) });
  }
  await apply('mixed');
  await page.reload();
  await expect(mode).toHaveValue('mixed');
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await page.getByRole('button', { name: 'Review again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You’re caught up', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('caught-up.png'), fullPage: true });
});
