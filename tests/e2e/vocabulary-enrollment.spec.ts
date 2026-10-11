import { test, expect, type BrowserContext } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const suffix = randomUUID();
const owner = `owner-${suffix}`,
  reader = `reader-${suffix}`,
  collaborator = `collaborator-${suffix}`;
const courseId = `course-${suffix}`,
  username = `public-${suffix.slice(0, 8)}`;
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
async function login(context: BrowserContext, id: string) {
  await context.addCookies([
    { name: 'authjs.session-token', value: id, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
}
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  for (const id of [owner, reader, collaborator]) {
    await db`insert into users(id,email,username,public_profile,show_courses) values(${id},${id + '@example.test'},${id === owner ? username : id},true,true)`;
    await db`insert into auth_sessions(session_token,user_id,expires) values(${id},${id},now()+interval '1 hour')`;
  }
  await db`insert into courses(id,owner_id,kind,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date,is_public)
    values(${courseId},${owner},'vocabulary','Public vocabulary','public-vocabulary','English','intermediate',0,'00:00',15,'Asia/Tehran','[]','2026-10-11',true)`;
  await db`insert into vocabulary_members(course_id,user_id) values(${courseId},${collaborator})`;
  for (let i = 0; i < 20; i++)
    await db`insert into vocabulary_words(id,course_id,word,explanation,persian_meaning,added_on) values(${`${courseId}-${i}`},${courseId},${`Word ${i}`},'Test meaning','معنی فارسی','2026-10-11')`;
});
test.afterAll(async () => {
  for (const id of [owner, reader, collaborator]) await db`delete from users where id=${id}`;
  await db.end();
});
test('public learners enroll independently, and invited collaborators share daily suggestions', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext({ baseURL: base }),
    collaboratorContext = await browser.newContext({ baseURL: base }),
    readerContext = await browser.newContext({ baseURL: base });
  try {
    await login(ownerContext, owner);
    await login(collaboratorContext, collaborator);
    await login(readerContext, reader);
    const ownerPage = await ownerContext.newPage(),
      collaboratorPage = await collaboratorContext.newPage(),
      readerPage = await readerContext.newPage();
    await ownerPage.goto(`/courses/${courseId}`);
    await collaboratorPage.goto(`/courses/${courseId}`);
    const suggestions = (page: typeof ownerPage) =>
      page
        .locator('section.panel')
        .filter({ has: page.getByRole('heading', { name: 'Today’s suggested words' }) })
        .locator('article h3');
    const dailyWords = await suggestions(ownerPage).allTextContents();
    expect(dailyWords).toHaveLength(10);
    expect(await suggestions(collaboratorPage).allTextContents()).toEqual(dailyWords);
    await readerPage.goto(`/u/${username}/courses/public-vocabulary`);
    await readerPage.getByRole('button', { name: 'Join and practice' }).click();
    await expect(readerPage).toHaveURL(`${base}/courses/${courseId}`);
    expect(
      (
        await db`select role from vocabulary_members where course_id=${courseId} and user_id=${reader}`
      )[0].role,
    ).toBe('learner');
    await expect(suggestions(readerPage)).toHaveCount(0);
    await expect(readerPage.getByRole('heading', { name: 'Add today’s words' })).toHaveCount(0);
    await readerPage.goto(`/u/${username}/courses/public-vocabulary`);
    await readerPage.getByRole('button', { name: 'Join and practice' }).click();
    await expect(readerPage).toHaveURL(`${base}/courses/${courseId}`);
    expect(
      (
        await db`select count(*)::int as n from vocabulary_members where course_id=${courseId} and user_id=${reader}`
      )[0].n,
    ).toBe(1);
    await ownerPage.getByLabel('Collaborator username').fill(reader);
    await ownerPage.getByRole('button', { name: 'Add collaborator', exact: true }).click();
    await expect(
      ownerPage.getByText('Collaborator added. This course is now in their My courses.'),
    ).toBeVisible();
    await readerPage.reload();
    expect(await suggestions(readerPage).allTextContents()).toEqual(dailyWords);
    await readerPage.getByRole('button', { name: 'Practice', exact: true }).click();
    await readerPage.getByRole('button', { name: 'Reveal answer' }).click();
    await readerPage.getByRole('button', { name: 'Remembered', exact: true }).click();
    await expect(readerPage.getByRole('button', { name: 'Reveal answer' })).toBeVisible();
    expect(
      (await db`select count(*)::int as n from vocabulary_progress where user_id=${reader}`)[0].n,
    ).toBe(1);
    expect(
      (await db`select count(*)::int as n from vocabulary_progress where user_id=${owner}`)[0].n,
    ).toBe(0);
    await db`update courses set is_public=false where id=${courseId}`;
    const guest = await browser.newPage({ baseURL: base });
    await guest.goto(`/u/${username}/courses/public-vocabulary`);
    await expect(guest.getByRole('heading', { name: 'This page isn’t available.' })).toBeVisible();
    await guest.close();
  } finally {
    await ownerContext.close();
    await collaboratorContext.close();
    await readerContext.close();
  }
});
