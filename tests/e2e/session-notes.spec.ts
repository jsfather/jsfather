import { test, expect, type Locator } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { StudyNoteFiles } from '../../src/lib/study-note-files';
config({ path: '.env.local', quiet: true });
const db = postgres(process.env.DATABASE_URL!, { max: 2 });
const files = new StudyNoteFiles();
const userId = randomUUID(),
  token = randomUUID(),
  otherId = randomUUID(),
  otherToken = randomUUID(),
  courseId = randomUUID();
const ids = [1280, 320, 390].map(() => randomUUID());
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
const closure =
  '# JavaScript closures\n\nA closure retains access to its lexical environment.\n\n### Key Points\n- Each call can create independent state.\n- A closure uses lexical scope.\n\n### Example\n```javascript\nfunction counter() {\n  let count = 0;\n  return () => ++count;\n}\nconst next = counter();\nconsole.log(next());\nconsole.log(next());\n```\n\n### Output\n```text\n1\n2\n```\n\n### Reference\n[MDN Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures)\n';
const mapping =
  '# Array mapping\n\nCreate a new array by transforming each element.\n\n### Key Points\n- The callback produces each new value.\n\n### Example\n```javascript\nconsole.log([1, 2].map(value => value * 2));\n```\n\n### Output\n```text\n[2, 4]\n```\n\n### Reference\n[MDN Array.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)\n';
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a disposable test database.');
  for (const [id, sessionToken] of [
    [userId, token],
    [otherId, otherToken],
  ]) {
    await db`insert into users(id,email,username,name) values(${id},${id + '@example.test'},${id},'Markdown Reader')`;
    await db`insert into auth_sessions(session_token,user_id,expires) values(${sessionToken},${id},now()+interval '1 hour')`;
  }
  await db`insert into courses(id,owner_id,title,slug,category,difficulty,total_sessions,scheduled_time,duration,timezone,weekdays,start_date)
    values(${courseId},${userId},'Programming notes',${courseId},'Backend','beginner',3,'09:00',30,'UTC','[1]','2026-10-01')`;
  for (const [i, id] of ids.entries())
    await db`insert into course_sessions(id,course_id,title,session_number,scheduled_date,duration)
    values(${id},${courseId},${'Note session ' + i},${i + 1},now(),30)`;
});
test.afterAll(async () => {
  await files.removeCourse({ userId, courseId });
  await db`delete from users where id in (${userId},${otherId})`;
  await db.end();
});
async function gap(a: Locator, b: Locator) {
  const first = (await a.boundingBox())!,
    second = (await b.boundingBox())!;
  expect(second.y - first.y - first.height).toBeGreaterThanOrEqual(15.5);
  expect(second.y - first.y - first.height).toBeLessThanOrEqual(24.5);
}
for (const [index, width] of [1280, 320, 390].entries()) {
  test(`multiple Markdown files, previews, edits and deletion at ${width}px`, async ({ page }) => {
    const sessionId = ids[index],
      scope = { userId, courseId, sessionId };
    await page.setViewportSize({ width, height: 1000 });
    await page
      .context()
      .addCookies([
        { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
    await page.goto(`/sessions/${sessionId}`);
    const notes = page.getByRole('region', { name: 'Session notes' });
    await expect(
      notes.getByText('No notes yet. Add your first Markdown note below.'),
    ).toBeVisible();
    await gap(
      notes.getByRole('heading', { name: 'Study notes (0)', exact: true }),
      notes.locator(':scope > p').first(),
    );
    const panelBox = (await notes.boundingBox())!,
      lastBox = (await notes.locator(':scope > details').boundingBox())!;
    expect(panelBox.y + panelBox.height - lastBox.y - lastBox.height).toBeGreaterThanOrEqual(16);
    expect(panelBox.y + panelBox.height - lastBox.y - lastBox.height).toBeLessThanOrEqual(33);
    await notes.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 80),
    );
    await page.screenshot({ path: test.info().outputPath('notes-empty.png') });
    await notes.getByText('Add a Markdown note', { exact: true }).click();
    const create = page.getByRole('form', { name: 'Add Markdown note', exact: true });
    await create.getByLabel('Filename', { exact: true }).fill('javascript-closures.md');
    await create
      .getByLabel('Topic folder (optional)', { exact: true })
      .fill('javascript/functions');
    await create.getByLabel('Markdown content', { exact: true }).fill(closure);
    await create.getByText('Preview Markdown', { exact: true }).click();
    const preview = create.locator('.study-markdown');
    await expect(preview.locator('h1')).toHaveText('JavaScript closures');
    await create
      .getByLabel('Markdown content', { exact: true })
      .fill(
        closure +
          '\n<script>window.__noteXss=true</script>\n<img src=x onerror="window.__noteXss=true">\n[Unsafe](javascript:alert(1))',
      );
    await expect(preview.locator('script, img, a[href^="javascript:"]')).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, '__noteXss'))).toBeUndefined();
    await create.getByLabel('Markdown content', { exact: true }).fill(closure);
    await expect(preview.locator('code.language-javascript .hljs-keyword').first()).toBeVisible();
    await expect(preview.locator('code.language-text')).toHaveText('1\n2\n');
    await gap(create.locator(':scope > details > summary'), preview);
    await gap(create.locator('.field-hint'), create.locator(':scope > details'));
    await gap(create.locator(':scope > details'), create.locator('.panel-actions'));
    await preview.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 80),
    );
    await page.screenshot({ path: test.info().outputPath('notes-preview.png') });
    if (width === 1280) {
      await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await preview.evaluate((element) =>
        window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 80),
      );
      await page.screenshot({ path: test.info().outputPath('notes-preview-light.png') });
      await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    }
    await create.getByRole('button', { name: 'Add note', exact: true }).click();
    await expect(create.getByRole('status')).toContainText('Markdown note added');
    const first = notes.locator('.session-note').filter({
      has: page.locator('.note-file-path', {
        hasText: 'javascript/functions/javascript-closures.md',
      }),
    });
    await expect(first.locator(':scope > summary')).toContainText('JavaScript closures');
    expect((await files.read(scope, 'javascript/functions/javascript-closures.md'))?.body).toBe(
      closure,
    );
    await create.getByLabel('Filename', { exact: true }).fill('array-mapping.md');
    await create.getByLabel('Topic folder (optional)', { exact: true }).fill('javascript/arrays');
    await create.getByLabel('Markdown content', { exact: true }).fill(mapping);
    await create.getByRole('button', { name: 'Add note', exact: true }).click();
    await expect(notes.locator('.session-note')).toHaveCount(2);
    // A duplicate path must keep the stored note and the unsaved editor text.
    await create.getByLabel('Filename', { exact: true }).fill('array-mapping.md');
    await create.getByLabel('Topic folder (optional)', { exact: true }).fill('javascript/arrays');
    await create
      .getByLabel('Markdown content', { exact: true })
      .fill(mapping + '\nUnsaved duplicate.');
    await create.getByRole('button', { name: 'Add note', exact: true }).click();
    await expect(create.getByRole('alert')).toContainText('already exists');
    await expect(create.getByLabel('Markdown content', { exact: true })).toContainText(
      'Unsaved duplicate.',
    );
    expect((await files.read(scope, 'javascript/arrays/array-mapping.md'))?.body).toBe(mapping);
    await first.locator(':scope > summary').click();
    await first.getByText('Edit note', { exact: true }).click();
    const edit = first.getByRole('form', {
      name: 'Edit javascript/functions/javascript-closures.md',
      exact: true,
    });
    await edit
      .getByLabel('Markdown content', { exact: true })
      .fill(
        closure.replace(
          'A closure uses lexical scope.',
          'A closure retains access after its outer function returns.',
        ),
      );
    await edit.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(edit.getByRole('status')).toContainText('Note updated');
    await expect(first.locator('.study-markdown').first()).toContainText(
      'after its outer function returns',
    );
    expect(await files.list(scope)).toHaveLength(2);
    const downloadEvent = page.waitForEvent('download');
    await first.getByRole('link', { name: 'Download .md', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('javascript-closures.md');
    expect(await readFile((await download.path())!, 'utf8')).toContain(
      'after its outer function returns',
    );
    await notes.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 80),
    );
    await page.screenshot({ path: test.info().outputPath('notes-populated-feedback.png') });
    // Restore normal full-page position so sticky controls are inspected in their real position.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: test.info().outputPath('session-populated-full.png'),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const second = notes.locator('.session-note').filter({
      has: page.locator('.note-file-path', { hasText: 'javascript/arrays/array-mapping.md' }),
    });
    await second.locator(':scope > summary').click();
    await second.getByRole('button', { name: 'Delete note', exact: true }).click();
    await page
      .getByLabel('Note path to confirm deletion', { exact: true })
      .fill('javascript/arrays/array-mapping.md');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(notes.locator('.session-note')).toHaveCount(1);
    expect(await files.read(scope, 'javascript/arrays/array-mapping.md')).toBeNull();
    await page.reload();
    await expect(notes.locator('.session-note')).toHaveCount(1);
  });
}
test('stale edits, private downloads, and timetable rebuild protection', async ({
  page,
  browser,
}) => {
  const sessionId = ids[0];
  await page
    .context()
    .addCookies([
      { name: 'authjs.session-token', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    ]);
  const scope = { userId, courseId, sessionId };
  if (!(await files.read(scope, 'javascript/functions/javascript-closures.md')))
    await files.save(scope, 'javascript/functions/javascript-closures.md', closure, '');
  await page.goto(`/sessions/${sessionId}`);
  const notes = page.getByRole('region', { name: 'Session notes' });
  const note = notes.locator('.session-note').first();
  await note.locator(':scope > summary').click();
  await note.getByText('Edit note', { exact: true }).click();
  const editor = note.getByRole('form');
  const current = (await files.read(scope, 'javascript/functions/javascript-closures.md'))!;
  await files.save(
    scope,
    current.path,
    current.body + '\nSaved in another tab.\n',
    current.version,
  );
  await editor.getByLabel('Markdown content', { exact: true }).fill(closure + '\nMy stale draft.');
  await editor.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('changed');
  await expect(editor.getByLabel('Markdown content', { exact: true })).toContainText(
    'My stale draft.',
  );
  const foreign = await browser.newContext();
  await foreign.addCookies([
    { name: 'authjs.session-token', value: otherToken, url: base, httpOnly: true, sameSite: 'Lax' },
  ]);
  const response = await foreign.request.get(
    `${base}/api/sessions/${sessionId}/notes?path=javascript/functions/javascript-closures.md`,
  );
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain('Saved in another tab');
  await foreign.close();
  const invalid = await page.request.get(`/api/sessions/${sessionId}/notes?path=..%2Fsecret.md`);
  expect(invalid.status()).toBe(400);
  await page.goto(`/courses/${courseId}/edit`);
  await page.getByLabel('Class time', { exact: true }).fill('11:00');
  await page.getByRole('button', { name: 'Save course', exact: true }).click();
  await expect(page.locator('.alert.error')).toContainText('notes');
  expect((await files.read(scope, current.path))?.body).toContain('Saved in another tab');
});
