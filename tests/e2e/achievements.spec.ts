import { test, expect, type Page, type Locator } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { format, addDays } from 'date-fns';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 3 });
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const ids: string[] = [];
test.beforeAll(() => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
});
test.afterAll(async () => {
  for (const id of ids) await db`delete from users where id=${id}`;
  await db.end();
});
async function gap(before: Locator, after: Locator, min = 16) {
  const spacing = await before.or(after).evaluateAll((elements) => {
    if (elements.length !== 2) throw new Error('Expected two elements for spacing measurement.');
    const [a, b] = elements.map((element) => element.getBoundingClientRect());
    return b.y - a.bottom;
  });
  expect(spacing).toBeGreaterThanOrEqual(min - 0.5);
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
async function course(owner: string, kind: string, shared: boolean, complete = true) {
  const id = randomUUID();
  await db`insert into courses(id,owner_id,title,slug,kind,category,difficulty,total_pages,current_page,credited_pages,total_sessions,scheduled_time,duration,timezone,weekdays,start_date,is_public)
    values(${id},${owner},${shared ? 'Shared learning' : 'PRIVATE_SECRET_COURSE'},${id},${kind},'Frontend','beginner',${kind === 'book' ? 100 : null},${kind === 'book' ? 100 : 0},${kind === 'book' ? 100 : 0},${kind === 'standard' && complete ? 1 : 0},'09:00',30,'UTC','[]','2026-10-17',${shared})`;
  if (kind === 'standard' && complete)
    await db`insert into course_sessions(id,course_id,title,session_number,scheduled_date,duration,status) values(${randomUUID()},${id},'Lesson 1',1,now(),30,'completed')`;
  return id;
}
async function exam(
  owner: string,
  courseId: string | null,
  bankId: string | null,
  score: number,
  isFinal = true,
) {
  const id = randomUUID(),
    attemptId = randomUUID();
  await db`insert into exams(id,course_id,category_bank_id,title,is_final) values(${id},${courseId},${bankId},'Assessment',${isFinal})`;
  await db`insert into exam_attempts(id,exam_id,user_id,score,max_score,percentage,passed,submitted_at) values(${attemptId},${id},${owner},${score},100,${score},true,now())`;
  return { id, attemptId };
}
async function questions(examId: string, count: number) {
  for (let i = 0; i < count; i++)
    await db`insert into exam_questions(id,exam_id,question,type,"order") values(${randomUUID()},${examId},'Original question','true_false',${i})`;
}
async function words(owner: string, courseId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const id = randomUUID(),
      difficulty = i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
      target = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15;
    await db`insert into vocabulary_words(id,course_id,word,explanation,difficulty,added_on) values(${id},${courseId},${'Word ' + i},'Definition',${difficulty},'2026-10-17')`;
    await db`insert into vocabulary_progress(word_id,user_id,successful_reviews,total_reviews) values(${id},${owner},${target},${target})`;
  }
}
for (const width of [1280, 320, 390])
  test(`achievements, saved progress and public privacy at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    const owner = randomUUID(),
      username = 'achievements-' + owner.slice(0, 8),
      token = randomUUID();
    ids.push(owner);
    await db`insert into users(id,email,username,name,timezone,public_profile,public_progress,show_courses,show_exam_scores) values(${owner},${owner + '@example.test'},${username},'Learning Explorer','UTC',true,true,true,true)`;
    await db`insert into auth_sessions(session_token,user_id,expires) values(${token},${owner},now()+interval '1 hour')`;
    await page
      .context()
      .addCookies([
        { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
    await page.goto('/profile');
    const achievements = page.getByRole('region', { name: 'Achievements', exact: true });
    await expect(achievements.getByText('0 earned', { exact: true })).toBeVisible();
    await gap(achievements.locator('> .section-header'), achievements.locator('> .field-hint'));
    await shot(page, 'owner-empty');
    await achievements.locator('summary').click();
    await expect(achievements.locator('[data-achievement="first-steps"]')).toContainText(
      '0 / 1 minutes',
    );
    await gap(achievements.locator('summary'), achievements.locator('details > div'));
    await expect(
      achievements.getByRole('progressbar', { name: 'First steps progress', exact: true }),
    ).toBeVisible();
    const illustrations = achievements.locator('svg[data-illustration]');
    await expect(illustrations).toHaveCount(22);
    const designs = await illustrations
      .locator('.achievement-character')
      .evaluateAll((items) => items.map((item) => item.innerHTML));
    expect(new Set(designs).size).toBe(22);
    await expect(achievements.locator('.achievement-art.is-locked')).toHaveCount(22);
    await shot(page, 'owner-explore-empty');
    const guestContext = await browser.newContext(),
      guest = await guestContext.newPage();
    await guest.setViewportSize({ width, height: 1000 });
    await guest.goto('/u/' + username);
    await expect(guest.getByText('No achievements from shared activity yet.')).toBeVisible();
    await shot(guest, 'public-empty');
    const sharedCourse = await course(owner, 'standard', true),
      privateCourse = await course(owner, 'standard', false);
    await course(owner, 'standard', true, false); // Zero-session courses must not count as completed.
    await course(owner, 'book', true);
    await course(owner, 'book', false);
    await course(owner, 'book', false);
    const publicWords = await course(owner, 'vocabulary', true),
      privateWords = await course(owner, 'vocabulary', false);
    await words(owner, publicWords, 10);
    await words(owner, privateWords, 40);
    // A hard word below fifteen successful recalls is not yet mastered.
    const hardId = randomUUID();
    await db`insert into vocabulary_words(id,course_id,word,explanation,difficulty,added_on) values(${hardId},${publicWords},'Not mastered','Definition','hard','2026-10-17')`;
    await db`insert into vocabulary_progress(word_id,user_id,successful_reviews,total_reviews) values(${hardId},${owner},14,14)`;
    const bankId = randomUUID();
    await db`insert into category_banks(id,owner_id,category) values(${bankId},${owner},'Frontend')`;
    const pub = await exam(owner, sharedCourse, null, 80);
    for (let i = 0; i < 5; i++)
      await db`insert into exam_attempts(id,exam_id,user_id,score,max_score,percentage,passed,submitted_at) values(${randomUUID()},${pub.id},${owner},80,100,80,true,now())`;
    for (let i = 0; i < 5; i++) await exam(owner, privateCourse, null, 100);
    const category = await exam(owner, null, bankId, 100);
    const sharedBank = randomUUID(),
      privateBank = randomUUID(),
      directBank = randomUUID();
    await db`insert into exams(id,course_id,title) values(${sharedBank},${sharedCourse},'Class questions'),(${privateBank},${privateCourse},'PRIVATE_SECRET_QUESTIONS')`;
    await db`insert into exams(id,category_bank_id,title) values(${directBank},${bankId},'Category questions')`;
    await questions(sharedBank, 9);
    await questions(privateBank, 41);
    await questions(directBank, 1);
    await questions(pub.id, 100); // Generated copies never count as authored questions.
    await db`insert into certificates(id,attempt_id,user_id,course_id,recipient_name,course_title,percentage) values(${randomUUID()},${pub.attemptId},${owner},${sharedCourse},'Learning Explorer','Course',80)`;
    await db`insert into certificates(id,attempt_id,user_id,category_bank_id,recipient_name,course_title,percentage) values(${randomUUID()},${category.attemptId},${owner},${bankId},'Learning Explorer','Frontend',100)`;
    for (let i = 0; i < 7; i++) {
      const day = format(addDays(new Date(), -i), 'yyyy-MM-dd');
      await db`insert into practice_days(user_id,day,seconds) values(${owner},${day},600)`;
      await db`insert into practice_sessions(id,user_id,course_id,day,activity,seconds,ended_at) values(${randomUUID()},${owner},${sharedCourse},${day},'lesson',300,now())`;
    }
    await page.reload();
    await expect(
      achievements.locator('[data-achievement="category-certified"] .achievement-status'),
    ).toHaveText('Earned');
    await expect(
      achievements.locator('[data-achievement="fifty-words"] .achievement-status'),
    ).toHaveText('Earned');
    await expect(
      achievements.locator('[data-achievement="fifty-questions"] .achievement-status'),
    ).toHaveText('Earned');
    await expect(
      achievements.locator('[data-achievement="perfect-exam"] .achievement-status'),
    ).toHaveText('Earned');
    await expect(
      achievements.locator('[data-achievement="category-certified"] .achievement-art.is-earned'),
    ).toBeVisible();
    await shot(page, 'owner-earned');
    await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await shot(page, 'owner-earned-light');
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await achievements.locator('summary').click();
    await expect(achievements.locator('[data-achievement="five-courses"]')).toContainText(
      '2 / 5 courses',
    );
    await expect(achievements.locator('[data-achievement="ten-classes"]')).toContainText(
      '2 / 10 lessons',
    );
    await shot(page, 'owner-progress');
    await guest.reload();
    const shared = guest.getByRole('region', { name: 'Achievements', exact: true });
    for (const id of [
      'first-steps',
      'week-streak',
      'first-class',
      'first-course',
      'hundred-pages',
      'first-book',
      'first-word-review',
      'ten-words',
      'first-exam',
      'course-certified',
    ])
      await expect(shared.locator(`[data-achievement="${id}"]`)).toBeVisible();
    for (const id of [
      'hour-wiser',
      'three-books',
      'fifty-words',
      'five-exams',
      'perfect-exam',
      'category-certified',
      'ten-questions',
      'fifty-questions',
    ])
      await expect(shared.locator(`[data-achievement="${id}"]`)).toHaveCount(0);
    expect(await guest.content()).not.toContain('PRIVATE_SECRET');
    await gap(shared.locator('> .field-hint'), shared.locator('> div').last());
    const card = shared.locator('[data-achievement="first-steps"]');
    await gap(card.locator('.achievement-title'), card.locator('.field-hint'));
    await gap(card.locator('.field-hint'), card.locator('.achievement-status'));
    await shot(guest, 'public-earned');
    await db`update exams set is_public=true where id in (${category.id},${directBank})`;
    await guest.reload();
    await expect(shared.locator('[data-achievement="category-certified"]')).toBeVisible();
    await expect(shared.locator('[data-achievement="ten-questions"]')).toBeVisible();
    await db`update users set show_exam_scores=false where id=${owner}`;
    await guest.reload();
    await expect(shared.getByRole('region', { name: 'Assessments', exact: true })).toHaveCount(0);
    await expect(shared.locator('[data-achievement="first-class"]')).toBeVisible();
    await shot(guest, 'public-scores-hidden');
    await db`update users set public_progress=false where id=${owner}`;
    await guest.reload();
    await expect(shared).toHaveCount(0);
    await shot(guest, 'public-progress-hidden');
    await db`update users set public_progress=true where id=${owner}`;
    await db`update courses set is_public=false where owner_id=${owner}`;
    await db`update exams set is_public=false where category_bank_id=${bankId}`;
    await guest.reload();
    await expect(guest.getByText('No achievements from shared activity yet.')).toBeVisible();
    await db`update users set public_profile=false where id=${owner}`;
    const response = await guest.goto('/u/' + username);
    expect(response?.status()).toBe(404);
    await guestContext.close();
  });
