import { test, expect, type APIRequestContext } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { previousDay } from '../../src/lib/practice';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 3 });
const owner = randomUUID(),
  other = randomUUID(),
  token = randomUUID(),
  otherToken = randomUUID();
const lesson = randomUUID(),
  vocab = randomUUID(),
  book = randomUUID(),
  foreign = randomUUID();
const examId = randomUUID(),
  attemptId = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const today = formatInTimeZone(new Date(), 'Asia/Tehran', 'yyyy-MM-dd');
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  await db`insert into users(id,email,username,timezone) values(${owner},${owner + '@example.test'},${'focus-' + owner.slice(0, 8)},'Asia/Tehran'),(${other},${other + '@example.test'},${'other-' + other.slice(0, 8)},'UTC')`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${token},${owner},now()+interval '1 hour'),(${otherToken},${other},now()+interval '1 hour')`;
  for (const [id, kind] of [
    [lesson, 'standard'],
    [vocab, 'vocabulary'],
    [book, 'book'],
    [foreign, 'standard'],
  ]) {
    await db`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_pages,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
      values(${id},${id === foreign ? other : owner},${kind},${'Focus ' + kind},${id},'English','beginner',${kind === 'book' ? 400 : null},0,'00:00',15,'Asia/Tehran','[]',${today})`;
  }
  await db`insert into exams(id,course_id,title,time_limit) values(${examId},${lesson},'Focus exam',60)`;
  await db`insert into exam_attempts(id,exam_id,user_id) values(${attemptId},${examId},${owner})`;
  await db`insert into practice_days(user_id,day,seconds) values(${owner},${previousDay(today)},300),(${owner},${previousDay(previousDay(today))},300)`;
});
test.afterAll(async () => {
  await db`delete from users where id in (${owner},${other})`;
  await db.end();
});
async function post(api: APIRequestContext, data: object) {
  return api.post('/api/practice', { data, headers: { origin: base } });
}
test('records every course type, enforces the goal, and makes time credits idempotent and bounded', async ({
  page,
  browser,
}) => {
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  for (const [courseId, activity] of [
    [lesson, 'lesson'],
    [vocab, 'vocabulary'],
    [book, 'reading'],
  ]) {
    const start = await post(page.request, { operation: 'start', courseId, activity });
    expect(start.status()).toBe(200);
    const { sessionId } = await start.json();
    let sequence = 0;
    for (const seconds of [30, 30, 30, 10]) {
      await db`update practice_sessions set last_heartbeat_at=now()-interval '31 seconds' where id=${sessionId}`;
      const body = {
        operation: 'heartbeat',
        sessionId,
        sequence: ++sequence,
        seconds,
        finish: sequence === 4,
      };
      const responses = await Promise.all([post(page.request, body), post(page.request, body)]);
      for (const response of responses) expect(response.status()).toBe(200);
    }
    const [session] = await db`select seconds from practice_sessions where id=${sessionId}`;
    expect(session.seconds).toBe(100);
  }
  const [day] = await db`select seconds from practice_days where user_id=${owner} and day=${today}`;
  expect(day.seconds).toBe(300);
  await page.goto('/dashboard');
  const habit = page.getByRole('region', { name: 'Daily practice and streak' });
  await expect(habit.getByRole('heading', { name: 'Today’s goal is complete' })).toBeVisible();
  await expect(habit.getByText('15.0 XP', { exact: true })).toBeVisible();
  await page.goto('/activity');
  await expect(page.getByRole('heading', { name: 'Time by course' })).toBeVisible();
  await expect(page.getByText(today, { exact: true })).toBeVisible();
  expect(
    (
      await post(page.request, { operation: 'start', courseId: foreign, activity: 'lesson' })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post('/api/practice', {
        data: { operation: 'start', courseId: lesson, activity: 'lesson' },
        headers: { origin: 'https://other.example' },
      })
    ).status(),
  ).toBe(403);
  const start = await post(page.request, {
    operation: 'start',
    courseId: lesson,
    activity: 'lesson',
  });
  const { sessionId } = await start.json();
  const otherContext = await browser.newContext({ baseURL: base });
  await otherContext.addCookies([
    { name: 'authjs.session-token', value: otherToken, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  expect(
    (
      await post(otherContext.request, {
        operation: 'heartbeat',
        sessionId,
        sequence: 1,
        seconds: 30,
      })
    ).status(),
  ).toBe(404);
  await db`update practice_sessions set last_heartbeat_at=now()-interval '5 seconds' where id=${sessionId}`;
  const clipped = await post(page.request, {
    operation: 'heartbeat',
    sessionId,
    sequence: 1,
    seconds: 30,
  });
  const clippedData = await clipped.json();
  expect(clippedData.sessionSeconds).toBeGreaterThanOrEqual(4);
  expect(clippedData.sessionSeconds).toBeLessThanOrEqual(6);
  expect(
    (
      await post(page.request, { operation: 'heartbeat', sessionId, sequence: 2, seconds: 1000 })
    ).status(),
  ).toBe(400);
  const replacement = await post(page.request, {
    operation: 'start',
    courseId: book,
    activity: 'reading',
  });
  expect(replacement.status()).toBe(200);
  expect(
    (
      await post(page.request, { operation: 'heartbeat', sessionId, sequence: 2, seconds: 1 })
    ).status(),
  ).toBe(409);
  await otherContext.close();
  const examStart = await post(page.request, {
    operation: 'start',
    courseId: lesson,
    activity: 'exam',
    attemptId,
  });
  expect(examStart.status()).toBe(200);
  const examSession = (await examStart.json()).sessionId;
  await db`update practice_sessions set last_heartbeat_at=now()-interval '31 seconds' where id=${examSession}`;
  await db`update exam_attempts set submitted_at=now() where id=${attemptId}`;
  const final = await post(page.request, {
    operation: 'heartbeat',
    sessionId: examSession,
    sequence: 1,
    seconds: 30,
    finish: true,
  });
  expect(final.status()).toBe(200);
  expect((await final.json()).sessionSeconds).toBe(30);
  const boundaryStart = await post(page.request, {
    operation: 'start',
    courseId: book,
    activity: 'reading',
  });
  const boundaryId = (await boundaryStart.json()).sessionId;
  const midnight = fromZonedTime(today + 'T00:00:00', 'Asia/Tehran');
  await db`update practice_sessions set started_at=${new Date(midnight.getTime() - 30000)}, last_heartbeat_at=${new Date(midnight.getTime() - 20000)} where id=${boundaryId}`;
  const boundaryBody = {
    operation: 'heartbeat',
    sessionId: boundaryId,
    sequence: 1,
    seconds: 30,
    capturedAt: midnight.getTime() + 10000,
    finish: true,
  };
  expect((await post(page.request, boundaryBody)).status()).toBe(200);
  expect((await post(page.request, boundaryBody)).status()).toBe(200);
  const [yesterday] =
    await db`select seconds from practice_days where user_id=${owner} and day=${previousDay(today)}`;
  expect(yesterday.seconds).toBe(320);
  await db`delete from courses where id=${vocab}`;
  const [retained] =
    await db`select seconds from practice_days where user_id=${owner} and day=${today}`;
  expect(retained.seconds).toBeGreaterThanOrEqual(334);
});
test('book timer records focused time and the daily overview fits mobile', async ({ page }) => {
  test.setTimeout(60000);
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  await page.goto(`/courses/${book}`);
  const timer = page.getByRole('region', { name: 'Practice time' });
  await expect(timer.getByRole('button', { name: 'Start reading', exact: true })).toBeVisible();
  const [baseline] =
    await db`select coalesce(sum(seconds),0)::int as seconds from practice_sessions where user_id=${owner} and course_id=${book}`;
  await page.getByRole('button', { name: 'Start reading', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db`select coalesce(sum(seconds),0)::int as seconds from practice_sessions where user_id=${owner} and course_id=${book}`
        )[0].seconds,
      { timeout: 25000 },
    )
    .toBeGreaterThan(baseline.seconds);
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await expect(timer.getByRole('button', { name: 'Start reading', exact: true })).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard');
    await expect(page.getByRole('region', { name: 'Daily practice and streak' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`streak-${width}.png`),
      animations: 'disabled',
    });
  }
});
