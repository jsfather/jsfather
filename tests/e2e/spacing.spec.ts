import { test, expect, type Locator } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { formatInTimeZone } from 'date-fns-tz';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const userId = randomUUID(),
  token = randomUUID(),
  bookId = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  await db`insert into users(id,email,username,name) values(${userId},${userId + '@example.test'},${'spacing-' + userId.slice(0, 8)},'Spacing Reader')`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${token},${userId},now()+interval '1 hour')`;
  await db`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_pages,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${bookId},${userId},'book','Book spacing',${bookId},'Backend','beginner',200,0,'00:00',60,'Asia/Tehran','[]','2026-10-14')`;
});
test.afterAll(async () => {
  await db`delete from users where id=${userId}`;
  await db.end();
});
async function gap(before: Locator, after: Locator, minimum = 16, maximum = 24) {
  // Read both rectangles in one frame when measuring the resting layout.
  const spacing = await before.or(after).evaluateAll((elements) => {
    if (elements.length !== 2) throw new Error('Expected two elements for spacing measurement.');
    const [a, b] = elements.map((element) => element.getBoundingClientRect());
    return b.y - a.bottom;
  });
  expect(spacing).toBeGreaterThanOrEqual(minimum - 0.5);
  expect(spacing).toBeLessThanOrEqual(maximum + 0.5);
}
for (const width of [320, 390, 1280]) {
  test(`helper text, form headings and panel actions have deliberate spacing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .context()
      .addCookies([
        { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
    // Keep each viewport's empty and populated states independent.
    await db`delete from practice_sessions where user_id=${userId}`;
    await db`delete from practice_days where user_id=${userId}`;
    await db`update courses set current_page=0,credited_pages=0 where id=${bookId}`;
    await page.goto('/dashboard');
    const daily = page.getByRole('region', { name: 'Daily practice and streak' });
    await expect(daily.getByRole('heading', { name: 'Start your daily streak' })).toBeVisible();
    await daily.screenshot({
      path: test.info().outputPath('streak-empty-panel.png'),
      animations: 'disabled',
    });
    const metricTops = await daily
      .locator('.daily-practice-stats strong')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().y));
    expect(Math.max(...metricTops) - Math.min(...metricTops)).toBeLessThan(1);
    const dailyHint = daily.locator('.daily-practice-footer > .field-hint');
    const practice = daily.getByRole('link', { name: 'Make time to practice', exact: true });
    await gap(dailyHint, practice);
    const section = (await daily.boundingBox())!,
      button = (await practice.boundingBox())!;
    const actions = (await daily.locator('.panel-actions').boundingBox())!;
    expect(section.y + section.height - actions.y - actions.height).toBeGreaterThanOrEqual(16);
    expect(section.y + section.height - actions.y - actions.height).toBeLessThanOrEqual(32);
    const reminder = daily.getByRole('link', { name: 'Set up practice reminders', exact: true });
    const linkText = await reminder.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return { y: rect.y, height: rect.height };
    });
    if (linkText.y < button.y + button.height)
      expect(
        Math.abs(linkText.y + linkText.height / 2 - button.y - button.height / 2),
      ).toBeLessThan(3);
    else expect(linkText.y - button.y - button.height).toBeGreaterThanOrEqual(11.5);
    await page.screenshot({
      path: test.info().outputPath('streak-empty.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto(`/courses/${bookId}`);
    const estimate = page.getByRole('region', { name: 'Automatic practice estimates' });
    await expect(estimate).toBeVisible();
    await gap(estimate.locator('.estimate-metrics'), estimate.locator('.field-hint'));
    await estimate.screenshot({ path: test.info().outputPath('automatic-estimate.png') });
    const progress = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Save progress', exact: true }) });
    await expect(
      progress.getByRole('button', { name: 'Save progress', exact: true }),
    ).toBeVisible();
    await gap(
      progress.locator('.field-hint'),
      progress.getByRole('button', { name: 'Save progress', exact: true }),
    );
    await progress
      .locator('..')
      .screenshot({ path: test.info().outputPath('book-empty-panel.png'), animations: 'disabled' });
    const notes = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Reading notes', exact: true }) });
    await gap(
      notes.getByRole('heading', { name: 'Reading notes', exact: true }),
      notes.getByLabel('Reading notes').locator('..'),
    );
    await gap(
      notes.locator('.field-hint'),
      notes.getByRole('button', { name: 'Save notes', exact: true }),
    );
    const bookmarks = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Bookmarks', exact: true }) });
    await gap(bookmarks.locator('p.muted').first(), bookmarks.locator('form').first());
    await gap(
      bookmarks.getByLabel('Bookmark notes (optional)').locator('..'),
      bookmarks.getByRole('button', { name: 'Add bookmark', exact: true }),
    );
    await progress.getByLabel('Last page read').fill('50');
    await progress.getByRole('button', { name: 'Save progress', exact: true }).click();
    await expect(progress.getByText('Reading progress saved.', { exact: true })).toBeVisible();
    // The hovered save button lifts by 1px; finish that interaction before measuring resting gaps.
    await page.mouse.move(0, 0);
    await expect(progress.getByRole('button', { name: 'Save progress', exact: true })).toHaveCSS(
      'transform',
      'none',
    );
    await gap(progress.locator('.alert'), progress.locator('.field'));
    await gap(
      progress.locator('.field-hint'),
      progress.getByRole('button', { name: 'Save progress', exact: true }),
    );
    await page.screenshot({
      path: test.info().outputPath('book-feedback.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await progress.getByLabel('Last page read').fill('201');
    await progress.evaluate((form) => {
      (form as HTMLFormElement).noValidate = true;
    });
    await progress.getByRole('button', { name: 'Save progress', exact: true }).click();
    await expect(progress.locator('.alert.error')).toBeVisible();
    await gap(progress.locator('.alert.error'), progress.locator('.field'));
    await page.goto('/settings');
    const settings = page.locator('.pwa-settings');
    await expect(
      settings.getByRole('heading', { name: 'Install & practice reminders' }),
    ).toBeVisible();
    await gap(
      settings.locator('p').nth(1),
      settings.getByRole('button', { name: 'Enable practice reminders' }),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await db`insert into practice_days(user_id,day,seconds) values(${userId},${formatInTimeZone(new Date(), 'Asia/Tehran', 'yyyy-MM-dd')},300) on conflict(user_id,day) do update set seconds=300`;
    await page.goto('/dashboard');
    await expect(daily.getByRole('heading', { name: 'Today’s goal is complete' })).toBeVisible();
    await expect(
      daily.getByRole('link', { name: 'Make time to practice', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath('streak-complete.png'),
      fullPage: true,
      animations: 'disabled',
    });
  });
}
