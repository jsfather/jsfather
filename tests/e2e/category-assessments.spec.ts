import { test, expect, type Page, type Locator } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 3 });
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const userIds: string[] = [];
test.beforeAll(() => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
});
test.afterAll(async () => {
  for (const id of userIds) await db`delete from users where id=${id}`;
  await db.end();
});
async function login(page: Page) {
  const id = randomUUID(),
    token = randomUUID();
  userIds.push(id);
  await db`insert into users(id,email,username,name) values(${id},${id + '@example.test'},${'category-' + id},'Category Learner')`;
  await db`insert into auth_sessions(session_token,user_id,expires) values(${token},${id},now()+interval '1 hour')`;
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  return id;
}
async function gap(before: Locator, after: Locator, min = 16) {
  const a = (await before.boundingBox())!,
    b = (await after.boundingBox())!;
  expect(b.y - a.y - a.height).toBeGreaterThanOrEqual(min - 0.5);
}
async function shot(page: Page, name: string) {
  await page.screenshot({
    path: test.info().outputPath(name + '.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
}
async function course(
  ownerId: string,
  category: string,
  title: string,
  count: number,
  generated = false,
) {
  const id = randomUUID(),
    sessionId = randomUUID(),
    examId = randomUUID();
  await db`insert into courses(id,owner_id,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${id},${ownerId},${title},${id},${category},'beginner',1,'09:00',60,'UTC','[1]','2026-10-17')`;
  await db`insert into course_sessions(id,course_id,title,session_number,scheduled_date,duration) values(${sessionId},${id},'Class 1',1,now(),60)`;
  await db`insert into exams(id,course_id,session_id,is_final,title) values(${examId},${id},${generated ? null : sessionId},${generated},${title + ' questions'})`;
  for (let i = 0; i < count; i++) await question(examId, title + ' question ' + i, i);
  return { id, examId };
}
async function question(examId: string, text: string, order: number) {
  const id = randomUUID();
  await db`insert into exam_questions(id,exam_id,question,type,"order",explanation) values(${id},${examId},${text},'true_false',${order},'SECRET_CATEGORY_KEY')`;
  await db`insert into exam_options(id,question_id,text,is_correct,"order") values(${randomUUID()},${id},'True',true,0),(${randomUUID()},${id},'False',false,1)`;
}
async function pass(page: Page, count: number) {
  expect(await page.content()).not.toContain('SECRET_CATEGORY_KEY');
  for (let i = 0; i < count; i++) {
    await page.getByRole('radio', { name: /True$/ }).check();
    if (i < count - 1) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Submit exam', exact: true }).click();
  await page.getByRole('button', { name: 'Submit answers', exact: true }).click();
  await expect(page).toHaveURL(/\/results\//);
}
for (const width of [1280, 320, 390])
  test(`category pools, randomized snapshots and spacing at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    const ownerId = await login(page);
    await page.goto('/courses');
    await expect(
      page.locator('.sidebar').getByRole('link', { name: 'Topics', exact: true }),
    ).toHaveCount(0);
    const form = page.getByRole('form', { name: 'Category questions and exams' });
    await gap(form.getByRole('heading'), form.locator('.field-hint'));
    await gap(form.locator('.field-hint'), form.locator('.field'));
    await gap(form.locator('.field'), form.locator('.panel-actions'));
    await shot(page, 'courses-empty');
    await page.getByLabel('Category', { exact: true }).evaluate((select: HTMLSelectElement) => {
      select.add(new Option('Invalid', 'invalid'));
      select.value = 'invalid';
    });
    await page.getByRole('button', { name: 'Open category', exact: true }).click();
    await expect(form.getByRole('alert')).toHaveText('Choose a category.');
    await gap(form.getByRole('alert'), form.locator('.panel-actions'));
    await shot(page, 'category-feedback');
    await page.getByLabel('Category', { exact: true }).selectOption('Frontend');
    await page.getByRole('button', { name: 'Open category', exact: true }).click();
    await expect(page).toHaveURL(/\/categories\/[a-f0-9-]{36}$/);
    const categoryUrl = page.url(),
      bankId = categoryUrl.split('/').at(-1)!;
    await expect(page.getByRole('button', { name: 'Test myself', exact: true })).toBeDisabled();
    await shot(page, 'category-empty');
    await page.getByRole('link', { name: 'Add questions', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Category questions', exact: true }),
    ).toBeVisible();
    await shot(page, 'category-editor-empty');
    await page.getByLabel('Question type').selectOption('true_false');
    await page
      .getByLabel('Question text', { exact: true })
      .fill('Direct Frontend category question');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByLabel('Question preview')).toContainText('Direct Frontend');
    await shot(page, 'category-editor-preview');
    await page.getByRole('button', { name: 'Save questions', exact: true }).click();
    await expect(page).toHaveURL(/\/exams\/[a-f0-9-]{36}$/);
    const directExamId = page.url().split('/').at(-1)!;
    const frontend1 = await course(ownerId, 'Frontend', 'React', 2);
    await course(ownerId, 'Frontend', 'CSS', 2);
    await course(ownerId, 'Backend', 'Backend excluded', 1);
    await course(ownerId, 'Frontend', 'Generated excluded', 1, true);
    const visitorContext = await browser.newContext(),
      visitor = await visitorContext.newPage();
    const visitorId = await login(visitor);
    await course(visitorId, 'Frontend', 'Other owner excluded', 1);
    await visitor.goto(categoryUrl);
    await expect(
      visitor.getByRole('heading', { name: 'This page isn’t available.' }),
    ).toBeVisible();
    await visitorContext.close();
    await page.goto(categoryUrl);
    const region = page.getByRole('region', { name: 'Category exam', exact: true });
    await expect(region).toContainText(
      '5 questions available · 4 from 2 courses · 1 added directly',
    );
    await gap(region.getByRole('heading'), region.locator('.field-hint'));
    await gap(region.locator('.field-hint'), region.locator('.muted'));
    await gap(region.locator('.muted'), region.locator('form'));
    const panelBox = (await region.boundingBox())!,
      actions = (await region.locator('form').boundingBox())!;
    expect(panelBox.y + panelBox.height - actions.y - actions.height).toBeGreaterThanOrEqual(16);
    await shot(page, 'category-populated');
    await page.getByRole('button', { name: 'Test myself', exact: true }).click();
    await expect(page).toHaveURL(/\/take\//);
    const attemptUrl = page.url(),
      examId = attemptUrl.split('/')[4];
    const source = await db`select * from exam_questions where exam_id=${examId} order by "order"`;
    expect(source).toHaveLength(5);
    expect(new Set(source.map((q) => q.question)).size).toBe(5);
    expect(source.some((q) => q.question.includes('excluded'))).toBe(false);
    expect(source.filter((q) => q.question.includes('React'))).toHaveLength(2);
    expect(source.filter((q) => q.question.includes('CSS'))).toHaveLength(2);
    expect(source.filter((q) => q.question.includes('Direct Frontend'))).toHaveLength(1);
    // Later additions are included next time, while the started exam retains its original snapshot.
    await question(frontend1.examId, 'New React course question', 2);
    await question(directExamId, 'New direct category question', 1);
    await page.reload();
    await pass(page, 5);
    await expect(page.getByText('100%', { exact: true })).toBeVisible();
    await shot(page, 'category-passed');
    const certs = await db`select * from certificates where user_id=${ownerId}`;
    expect(certs).toHaveLength(1);
    expect(certs[0].category_bank_id).toBe(bankId);
    expect(certs[0].course_id).toBeNull();
    await page.getByRole('link', { name: 'View certificate', exact: true }).click();
    await expect(page.locator('.certificate')).toContainText('category assessment');
    await shot(page, 'category-certificate');
    await page.goto(categoryUrl);
    await expect(
      page.getByRole('link', { name: 'View category certificate', exact: true }),
    ).toBeVisible();
    await expect(region).toContainText(
      '7 questions available · 5 from 2 courses · 2 added directly',
    );
    await page.getByRole('button', { name: 'Test myself', exact: true }).click();
    await expect(page).toHaveURL(/\/take\//);
    const secondId = page.url().split('/')[4];
    expect(secondId).not.toBe(examId);
    expect(await db`select id from exam_questions where exam_id=${secondId}`).toHaveLength(7);
    expect(await db`select id from exam_questions where exam_id=${examId}`).toHaveLength(5);
    // Moving a course to another category removes its bank from the next category exam.
    await db`update courses set category='Backend' where id=${frontend1.id}`;
    await page.goto(categoryUrl);
    await expect(region).toContainText(
      '4 questions available · 2 from 1 courses · 2 added directly',
    );
    await shot(page, 'category-updated');
    await page.goto('/courses');
    await shot(page, 'courses-populated');
  });
