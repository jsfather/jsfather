import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import awl from '../../src/data/academic-word-list.json';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const owner = randomUUID(),
  courseId = randomUUID(),
  wordId = randomUUID(),
  reviewId = randomUUID();
const entry = awl.find((w) => w.word === 'analyse')!;
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  await db`insert into users(id,email,username) values(${owner},${owner + '@example.test'},${'pron-' + owner.slice(0, 8)})`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${owner},${owner},now()+interval '1 hour')`;
  await db`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${courseId},${owner},'vocabulary','Pronunciation practice','pronunciation-practice','English','intermediate',0,'00:00',15,'Asia/Tehran','[]','2026-10-13')`;
  await db`insert into vocabulary_words(id,course_id,word,explanation,persian_meaning,pronunciation_ipa,pronunciation_fa,related_forms,added_on)
    values(${wordId},${courseId},${entry.word},${entry.persianMeaning},${entry.persianMeaning},${entry.pronunciationIpa},${entry.pronunciationFa},${db.json(entry.relatedForms)},'2026-10-13')`;
  await db`insert into vocabulary_reviews(id,course_id,word_id,user_id,word_version,word_snapshot,direction)
    values(${reviewId},${courseId},${wordId},${owner},1,${db.json({ word: entry.word, explanation: entry.persianMeaning, example: '', difficulty: 'medium' })},'meaning')`;
});
test.afterAll(async () => {
  await db`delete from users where id=${owner}`;
  await db.end();
});
test('pronunciation appears on daily words and only after a recall answer is revealed', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: 390, height: 900 },
  });
  await context.addCookies([
    { name: 'authjs.session-token', value: owner, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  await context.addInitScript(() => {
    const spoken: { text: string; lang: string; rate: number }[] = [];
    Object.assign(window, { pronunciationTestSpoken: spoken });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        text: string;
        lang = '';
        rate = 1;
        voice = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        getVoices() {
          return [{ lang: 'en-US', name: 'Test English' }];
        },
        speak(u: { text: string; lang: string; rate: number }) {
          spoken.push({ text: u.text, lang: u.lang, rate: u.rate });
        },
      },
    });
  });
  try {
    const page = await context.newPage();
    await page.goto(`/courses/${courseId}`);
    const daily = page.locator('.vocabulary-suggestion');
    await expect(daily.getByText(entry.pronunciationIpa, { exact: true })).toBeVisible();
    await expect(daily.getByText(entry.pronunciationFa, { exact: true })).toBeVisible();
    await daily.getByRole('button', { name: 'Listen to analyse in English', exact: true }).click();
    await daily
      .getByRole('button', { name: 'Listen slowly to analyse in English', exact: true })
      .click();
    const spoken = await page.evaluate(
      () =>
        (
          window as unknown as {
            pronunciationTestSpoken: { text: string; lang: string; rate: number }[];
          }
        ).pronunciationTestSpoken,
    );
    expect(spoken.map((v) => v.text)).toEqual(['analyse', 'analyse']);
    expect(spoken.every((v) => v.lang === 'en-US')).toBe(true);
    expect(spoken[1].rate).toBeLessThan(spoken[0].rate);
    await page.goto(`/courses/${courseId}/review/${reviewId}`);
    await expect(page.locator('.word-pronunciation')).toHaveCount(0);
    await expect(page.locator('.vocabulary-related-forms')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(page.getByText(entry.pronunciationIpa, { exact: true })).toBeVisible();
    await expect(page.getByText(entry.pronunciationFa, { exact: true })).toBeVisible();
    expect(await page.locator('.vocabulary-related-forms > span').allTextContents()).toEqual(
      entry.relatedForms,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath('pronunciation-reveal-mobile.png'),
      fullPage: true,
    });
    await page.reload();
    await expect(page.locator('.vocabulary-related-forms')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reveal answer' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
