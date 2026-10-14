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
      await page.goto(
        `/courses/${reviewId === longReview ? longCourseId : courseId}/review/${reviewId}`,
      );
      const reveal = page.getByRole('button', { name: 'Reveal answer', exact: true });
      const revealPosition = (await reveal.count()) ? await reveal.boundingBox() : null;
      if (await reveal.count()) await reveal.click();
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
      if (reviewId === longReview)
        await page.screenshot({
          path: test.info().outputPath(`review-${viewport.width}.png`),
          animations: 'disabled',
        });
      await page.keyboard.press('Tab');
      await expect(remembered).toBeFocused();
    }
  }
});
