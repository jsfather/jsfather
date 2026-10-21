import { test, expect, type Locator } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { StudyNoteFiles } from '../../src/lib/study-note-files';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const files = new StudyNoteFiles();
const owner = randomUUID(),
  token = randomUUID(),
  stranger = randomUUID(),
  strangerToken = randomUUID();
const firstCourse = randomUUID(),
  secondCourse = randomUUID(),
  privateCourse = randomUUID();
const firstSession = randomUUID(),
  secondSession = randomUUID(),
  archiveSession = randomUUID(),
  privateSession = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const content = (title: string, text: string) =>
  `# ${title}\n\n${text}\n\n### Key Points\n- Keep examples minimal and predictable.\n\n### Example\n\`\`\`javascript\nconsole.log(1);\n\`\`\`\n\n### Output\n\`\`\`text\n1\n\`\`\`\n\n### Reference\n[MDN Console](https://developer.mozilla.org/en-US/docs/Web/API/console/log_static)\n`;
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable database.');
  for (const [id, sessionToken] of [
    [owner, token],
    [stranger, strangerToken],
  ]) {
    await db`insert into users(id,email,username,name) values(${id},${id + '@example.test'},${id},'Notes Reader')`;
    await db`insert into auth_sessions(session_token,user_id,expires) values(${sessionToken},${id},now()+interval '1 hour')`;
  }
  for (const [id, title, user] of [
    [firstCourse, 'JavaScript essentials', owner],
    [secondCourse, 'Other programming notes', owner],
    [privateCourse, 'Private course', stranger],
  ]) {
    await db`insert into courses(id,owner_id,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
      values(${id},${user},${title},${id},'Backend','beginner',1,'09:00',30,'UTC','[1]','2026-10-01')`;
  }
  for (const [id, course, title, number] of [
    [firstSession, firstCourse, 'Learning console output', 1],
    [secondSession, firstCourse, 'Further examples', 2],
    [archiveSession, secondCourse, 'Collected examples', 1],
    [privateSession, privateCourse, 'Private session', 1],
  ] as const) {
    await db`insert into course_sessions(id,course_id,title,session_number,scheduled_date,duration) values(${id},${course},${title},${number},now(),30)`;
  }
  await files.save(
    { userId: owner, courseId: firstCourse, sessionId: firstSession },
    'javascript/console-output.md',
    content('Console output', 'A searchable concept: observable-output.'),
    '',
  );
  await files.save(
    { userId: owner, courseId: firstCourse, sessionId: firstSession },
    'javascript/minimal-examples.md',
    content('Minimal examples', 'A focused example is easier to review.'),
    '',
  );
  await db`update course_sessions set notes='An existing note from the original editor.' where id=${secondSession}`;
  for (let i = 0; i < 13; i++)
    await files.save(
      { userId: owner, courseId: secondCourse, sessionId: archiveSession },
      `examples/example-${i + 1}.md`,
      content(`Example ${i + 1}`, 'An example for the collected notes.'),
      '',
    );
  await files.save(
    { userId: stranger, courseId: privateCourse, sessionId: privateSession },
    'private.md',
    content('Private secret concept', 'owner-only-secret-phrase'),
    '',
  );
});
test.afterAll(async () => {
  for (const [userId, courseId] of [
    [owner, firstCourse],
    [owner, secondCourse],
    [stranger, privateCourse],
  ])
    await files.removeCourse({ userId, courseId });
  await db`delete from users where id in (${owner},${stranger})`;
  await db.end();
});
async function gap(before: Locator, after: Locator, minimum = 16, maximum = 24) {
  const a = (await before.boundingBox())!,
    b = (await after.boundingBox())!;
  expect(b.y - a.y - a.height).toBeGreaterThanOrEqual(minimum - 0.5);
  expect(b.y - a.y - a.height).toBeLessThanOrEqual(maximum + 0.5);
}
for (const width of [1280, 320, 390]) {
  test(`notes have priority and a shared reading workspace at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .context()
      .addCookies([
        { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
    await page.goto(`/sessions/${firstSession}`);
    const notesPanel = page.getByRole('region', { name: 'Session notes', exact: true });
    const reviewPanel = page.getByRole('region', { name: 'Review this lesson', exact: true });
    const firstPanel = page.locator('.session-page-sections > section').first();
    await expect(firstPanel).toHaveAttribute('aria-label', 'Session notes');
    await gap(page.locator('.page-heading'), notesPanel, 24, 24);
    expect((await notesPanel.boundingBox())!.y).toBeLessThan((await reviewPanel.boundingBox())!.y);
    await page.screenshot({ path: test.info().outputPath('session-notes-first.png') });
    await notesPanel.getByRole('link', { name: 'Open notes workspace', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/notes\\?session=${firstSession}`));
    await expect(page.getByRole('heading', { name: 'Study notes', exact: true })).toBeVisible();
    await expect(page.locator('.notes-reading-card')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Console output', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Minimal examples', exact: true }),
    ).toBeVisible();
    const filters = page.getByRole('form', { name: 'Filter study notes' });
    await gap(filters.locator('.field-hint'), filters.locator('.panel-actions'));
    await filters.getByText('Course, session & topic filters', { exact: true }).click();
    await gap(filters.locator('summary'), filters.locator('.notes-filter-grid'));
    await expect(filters.getByLabel('Session', { exact: true })).toHaveValue(firstSession);
    await page.screenshot({
      path: test.info().outputPath('notes-filters-expanded.png'),
      fullPage: true,
    });
    await filters.getByText('Course, session & topic filters', { exact: true }).click();
    await page
      .locator('.notes-reading-card')
      .first()
      .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80));
    await page.screenshot({ path: test.info().outputPath('notes-reader.png') });
    const consoleNote = page.getByRole('article', { name: 'Console output', exact: true });
    await consoleNote.getByText('Edit note', { exact: true }).click();
    const editor = consoleNote.getByRole('form', {
      name: 'Edit javascript/console-output.md',
      exact: true,
    });
    await editor
      .getByLabel('Markdown content', { exact: true })
      .fill(
        content(
          'Console output',
          'A searchable concept: observable-output. Updated from the workspace.',
        ),
      );
    await editor.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(editor.getByRole('status')).toContainText('Note updated');
    await expect(consoleNote.locator('.study-markdown').first()).toContainText(
      'Updated from the workspace',
    );
    await page.screenshot({ path: test.info().outputPath('notes-edit-feedback.png') });
    await filters.getByLabel('Search notes', { exact: true }).fill('observable-output');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(page.locator('.notes-reading-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Console output', exact: true })).toBeVisible();
    await filters.getByLabel('Search notes', { exact: true }).fill('no-such-concept');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    const empty = page.getByRole('region', { name: 'No matching notes' });
    await expect(empty).toBeVisible();
    await gap(empty.locator('p'), empty.locator('.panel-actions'));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: test.info().outputPath('notes-no-results.png'), fullPage: true });
    await filters.getByRole('link', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('.notes-reading-card')).toHaveCount(12);
    await page.getByRole('link', { name: 'Next', exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('.notes-reading-card')).toHaveCount(4);
    await expect(page.locator('main')).not.toContainText('owner-only-secret-phrase');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('course, session and topic filters remain private and empty libraries guide note creation', async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  await page.goto('/notes');
  const filters = page.getByRole('form', { name: 'Filter study notes' });
  await filters.getByText('Course, session & topic filters', { exact: true }).click();
  await filters.getByLabel('Course', { exact: true }).selectOption(firstCourse);
  await filters.getByLabel('Session', { exact: true }).selectOption(secondSession);
  await filters.getByLabel('Topic', { exact: true }).selectOption('__general');
  await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Imported study notes', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.notes-reading-card')).toHaveCount(1);
  await page.goto(`/notes?session=${privateSession}`);
  await expect(page.getByRole('heading', { name: 'No notes match these filters' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('owner-only-secret-phrase');
  await files.removeCourse({ userId: stranger, courseId: privateCourse });
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: strangerToken,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/notes');
  await expect(page.getByRole('heading', { name: 'Your notes start here' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose a course', exact: true })).toBeVisible();
  for (const width of [1280, 320, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const empty = page.getByRole('region', { name: 'No matching notes' });
    await gap(empty.locator('p'), empty.locator('.panel-actions'));
    const panelBox = (await empty.boundingBox())!,
      actionsBox = (await empty.locator('.panel-actions').boundingBox())!;
    expect(panelBox.y + panelBox.height - actionsBox.y - actionsBox.height).toBeGreaterThanOrEqual(
      16,
    );
    expect(panelBox.y + panelBox.height - actionsBox.y - actionsBox.height).toBeLessThanOrEqual(33);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: test.info().outputPath(`notes-empty-library-${width}.png`),
      fullPage: true,
    });
  }
  await page.context().clearCookies();
  await page.goto('/notes');
  await expect(page).toHaveURL(/\/login/);
});
