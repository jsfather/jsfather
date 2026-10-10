import { test, expect, type BrowserContext } from '@playwright/test';
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { users, authSessions } from '../../src/db/schema';
config({ path: '.env.local' });
config();
const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client);
const id = randomUUID(),
  otherId = randomUUID(),
  token = randomUUID(),
  otherToken = randomUUID();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3100';
async function login(context: BrowserContext, sessionToken: string) {
  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: sessionToken,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
test.beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Use a test database.');
  await db.insert(users).values([
    { id, email: `${id}@example.test`, universityName: 'First campus' },
    { id: otherId, email: `${otherId}@example.test`, universityName: 'Second campus' },
  ]);
  await db.insert(authSessions).values([
    { userId: id, sessionToken: token, expires: new Date(Date.now() + 3600000) },
    { userId: otherId, sessionToken: otherToken, expires: new Date(Date.now() + 3600000) },
  ]);
});
test.afterAll(async () => {
  await db.delete(users).where(eq(users.id, id));
  await db.delete(users).where(eq(users.id, otherId));
  await client.end();
});
test('account branding persists across browsers and stays separate from guests and other accounts', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('jsfather-university-name', 'Guest campus'));
  await login(page.context(), token);
  await page.goto('/dashboard');
  const name = page.getByRole('textbox', { name: 'University name' });
  await expect(name).toHaveValue('First campus');
  await name.focus();
  await name.fill('دانشگاه من');
  await name.press('Enter');
  await expect(page.getByRole('status')).toContainText('Made it yours.');
  await expect
    .poll(async () => (await db.select().from(users).where(eq(users.id, id)))[0].universityName)
    .toBe('دانشگاه من');
  await page.reload();
  await expect(name).toHaveValue('دانشگاه من');
  await expect(page).toHaveTitle(/دانشگاه من Personal University/);
  const second = await browser.newContext();
  try {
    await login(second, token);
    const otherPage = await second.newPage();
    await otherPage.goto('/');
    await expect(otherPage.getByRole('textbox', { name: 'University name' })).toHaveValue(
      'دانشگاه من',
    );
    await login(second, otherToken);
    await otherPage.reload();
    await expect(otherPage.getByRole('textbox', { name: 'University name' })).toHaveValue(
      'Second campus',
    );
  } finally {
    await second.close();
  }
  await page.context().clearCookies();
  await page.goto('/');
  await expect(name).toHaveValue('Guest campus');
  expect(await page.evaluate(() => localStorage.getItem('jsfather-university-name'))).toBe(
    'Guest campus',
  );
});
