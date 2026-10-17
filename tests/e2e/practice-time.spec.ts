import { test, expect, type Request } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { formatInTimeZone } from 'date-fns-tz';
import { previousDay } from '../../src/lib/practice';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 3 });
const owner = randomUUID(),
  token = randomUUID(),
  book = randomUUID(),
  lesson = randomUUID(),
  vocab = randomUUID(),
  session = randomUUID(),
  word = randomUUID();
const username = 'auto-' + owner.slice(0, 8);
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const today = formatInTimeZone(new Date(), 'Asia/Tehran', 'yyyy-MM-dd');
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable database');
  await db`insert into users(id,email,username,name,bio,public_profile,public_progress,show_courses) values(${owner},${owner + '@example.test'},${username},'Avery · Lifelong learner','A little code, a little language, a chapter every day.',true,true,true)`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${token},${owner},now()+interval '1 hour')`;
  for (const [id, kind, title, shared] of [
    [book, 'book', 'Designing better systems', true],
    [lesson, 'standard', 'PRIVATE_LESSON', false],
    [vocab, 'vocabulary', 'Everyday English', true],
  ] as const) {
    await db`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_pages,total_sessions,scheduled_time,duration,timezone,weekdays,start_date,is_public)
      values(${id},${owner},${kind},${title},${id},'Backend','beginner',${kind === 'book' ? 400 : null},${kind === 'standard' ? 1 : 0},'00:00',20,'Asia/Tehran','[]',${today},${shared})`;
  }
  await db`insert into course_sessions(id,course_id,title,session_number,scheduled_date,duration) values(${session},${lesson},'A completed lesson',1,now(),20)`;
  await db`insert into vocabulary_words(id,course_id,word,explanation,added_on) values(${word},${vocab},'consistency','Showing up each day.',${today})`;
  let day = today;
  for (let i = 0; i < 8; i++) {
    day = previousDay(day);
    await db`insert into practice_sessions(id,user_id,course_id,source_key,day,activity,seconds,ended_at) values(${randomUUID()},${owner},${book},${randomUUID()},${day},'reading',600,now())`;
    await db`insert into practice_days(user_id,day,seconds) values(${owner},${day},600)`;
  }
});
test.afterAll(async () => {
  await db`delete from users where id=${owner}`;
  await db.end();
});
test('outcomes earn estimates once, idle pages earn nothing, and private activity stays private', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  const replay = async (req: Request) =>
    page.request.post(req.url(), {
      headers: {
        'next-action': req.headers()['next-action'],
        'content-type': req.headers()['content-type'],
        origin: base,
      },
      data: req.postDataBuffer()!,
      maxRedirects: 0,
    });
  const total = async () =>
    Number(
      (
        await db`select coalesce(sum(seconds),0)::int as total from practice_sessions where user_id=${owner}`
      )[0].total,
    );
  await page.goto('/courses/' + book);
  await expect(page.getByRole('region', { name: 'Automatic practice estimates' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Start reading|Start practice|Pause/ }),
  ).toHaveCount(0);
  expect(await total()).toBe(4800);
  await page.getByLabel('Last page read', { exact: true }).fill('3');
  let captured = page.waitForRequest((req) => req.method() === 'POST');
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  const bookSave = await captured;
  await expect(page.getByText('Reading progress saved.', { exact: true })).toBeVisible();
  expect(await total()).toBe(5160);
  await replay(bookSave);
  for (const position of ['1', '3']) {
    await page.getByLabel('Last page read', { exact: true }).fill(position);
    await page.getByRole('button', { name: 'Save progress', exact: true }).click();
    await expect(page.getByText('Reading progress saved.', { exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        Number((await db`select current_page from courses where id=${book}`)[0].current_page),
      )
      .toBe(Number(position));
  }
  expect(await total()).toBe(5160);
  await page.goto('/sessions/' + session);
  captured = page.waitForRequest((req) => req.method() === 'POST');
  await page.getByRole('button', { name: 'Mark as completed', exact: true }).click();
  const lessonSave = await captured;
  await expect(page.getByRole('button', { name: 'Reopen session', exact: true })).toBeVisible();
  expect(await total()).toBe(6360);
  await Promise.all([replay(lessonSave), replay(lessonSave)]);
  await page.getByRole('button', { name: 'Reopen session', exact: true }).click();
  await page.getByRole('button', { name: 'Mark as completed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reopen session', exact: true })).toBeVisible();
  expect(await total()).toBe(6360);
  await page.goto('/courses/' + vocab);
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  captured = page.waitForRequest((req) => req.method() === 'POST');
  await page.getByRole('button', { name: 'Remembered', exact: true }).click();
  const reviewSave = await captured;
  await expect(page).not.toHaveURL(/review\/[a-f0-9-]+$/);
  await Promise.all([replay(reviewSave), replay(reviewSave)]);
  expect(await total()).toBe(6390);
  const [day] = await db`select seconds from practice_days where user_id=${owner} and day=${today}`;
  expect(day.seconds).toBe(1590);
  expect(
    (
      await page.request.post('/api/practice', {
        data: { operation: 'start', courseId: book, activity: 'reading' },
      })
    ).status(),
  ).toBe(410);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Today’s goal is complete', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('106.5 XP', { exact: true })).toBeVisible();
  const guest = await browser.newContext();
  const publicPage = await guest.newPage();
  for (const width of [1280, 390, 320]) {
    await publicPage.setViewportSize({ width, height: 1000 });
    await publicPage.goto('/u/' + username);
    const shared = publicPage.getByRole('region', { name: 'Shared learning activity' });
    await expect(shared.getByRole('heading', { name: 'Building a learning habit' })).toBeVisible();
    await expect(shared.getByText('86.5 XP', { exact: true })).toBeVisible();
    await expect(publicPage.getByText('PRIVATE_LESSON', { exact: true })).toHaveCount(0);
    await expect(shared.getByRole('listitem')).toHaveCount(28);
    expect(
      await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const bounds = await shared.locator('.public-calendar-section').boundingBox();
    const hint = await shared.locator('> .field-hint').boundingBox();
    expect(hint!.y - (bounds!.y + bounds!.height)).toBeGreaterThanOrEqual(23);
    await publicPage.screenshot({
      path: test.info().outputPath('public-profile-' + width + '.png'),
      fullPage: true,
    });
  }
  await db`update users set public_progress=false where id=${owner}`;
  await publicPage.reload();
  await expect(publicPage.getByRole('region', { name: 'Shared learning activity' })).toHaveCount(0);
  await expect(publicPage.getByText('86.5 XP', { exact: true })).toHaveCount(0);
  await db`update users set public_progress=true where id=${owner}`;
  await db`delete from practice_sessions where user_id=${owner} and course_id in (${book},${vocab})`;
  for (const width of [1280, 390, 320]) {
    await publicPage.setViewportSize({ width, height: 1000 });
    await publicPage.reload();
    const empty = publicPage.getByRole('region', { name: 'Shared learning activity' });
    await expect(empty.getByText('0.0 XP', { exact: true })).toBeVisible();
    await expect(publicPage.locator('[data-achievement="first-steps"]')).toHaveCount(0);
    await empty.screenshot({ path: test.info().outputPath('public-empty-' + width + '.png') });
  }
  await db`update users set public_profile=false where id=${owner}`;
  const response = await publicPage.goto('/u/' + username);
  expect(response?.status()).toBe(404);
  await guest.close();
});

test('exam submissions automatically credit capped elapsed time and never count retries', async ({
  page,
}) => {
  const exam = randomUUID(),
    attempt = randomUUID(),
    question = randomUUID(),
    yes = randomUUID();
  await db`insert into exams(id,course_id,title,time_limit) values(${exam},${lesson},'Estimated exam',2)`;
  await db`insert into exam_questions(id,exam_id,question,type,"order") values(${question},${exam},'Ready?','multiple_choice',0)`;
  await db`insert into exam_options(id,question_id,text,is_correct,"order") values(${yes},${question},'Yes',true,0)`;
  await db`insert into exam_attempts(id,exam_id,user_id,started_at) values(${attempt},${exam},${owner},now()-interval '10 minutes')`;
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  const captured = page.waitForRequest((req) => req.method() === 'POST');
  await page.goto(`/exams/${exam}/take/${attempt}`);
  const request = await captured;
  await expect(page).toHaveURL(new RegExp(`/results/${attempt}$`));
  await page.request.post(request.url(), {
    headers: {
      'next-action': request.headers()['next-action'],
      'content-type': request.headers()['content-type'],
      origin: base,
    },
    data: request.postDataBuffer()!,
    maxRedirects: 0,
  });
  const credits =
    await db`select seconds from practice_sessions where source_key=${'exam:' + attempt}`;
  expect(credits.map((c) => c.seconds)).toEqual([120]);
});
