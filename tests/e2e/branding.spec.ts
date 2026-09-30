import { test, expect, type Locator } from '@playwright/test';

const storageKey = 'jsfather-university-name';

async function replaceName(input: Locator, value: string) {
  // Begin editing before replacing text; initial focus intentionally moves the caret.
  await input.focus();
  await input.fill(value);
}

test('rename without logging in, persist on reload, and keep branding consistent', async ({
  page,
}) => {
  await page.goto('/');
  const name = page.getByRole('textbox', { name: 'University name' });
  await expect(name).toHaveValue('jsfather');
  expect(await page.title()).toContain('jsfather Personal University');
  expect(await page.textContent('body')).not.toMatch(/JSFather|JSFATHER/);
  await name.focus();
  await expect(page.getByText('Enter to save · Esc to cancel')).toBeVisible();
  expect(
    await name.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd]),
  ).toEqual([8, 8]);
  await replaceName(name, 'Akbar');
  await name.press('Enter');
  await expect(page.getByRole('status')).toContainText('Made it yours.');
  await expect(page.locator('.landing-footer')).toContainText('Akbar Personal University');
  await expect(page).toHaveTitle('Akbar Personal University — Build your own university');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('Akbar');
  await page.reload();
  await expect(name).toHaveValue('Akbar');
  await expect(page).toHaveTitle('Akbar Personal University — Build your own university');
  await page.goto('/login');
  await expect(name).toHaveValue('Akbar');
  await expect(page).toHaveTitle('Welcome back — Akbar Personal University');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveTitle('Akbar Personal University — Build your own university');
});

test('first click places a blinking caret at the end and the pencil starts editing', async ({
  page,
}) => {
  await page.goto('/');
  const name = page.getByRole('textbox', { name: 'University name' });
  await name.click({ position: { x: 3, y: 10 } });
  expect(
    await name.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd]),
  ).toEqual([8, 8]);
  await name.press('End');
  await name.press('!');
  await expect(name).toHaveValue('jsfather!');
  // Drafts do not change the tab title until the user saves.
  await expect(page).toHaveTitle('jsfather Personal University — Build your own university');
  await name.press('Escape');
  await page.getByRole('button', { name: 'Rename university' }).click();
  await expect(name).toBeFocused();
  expect(
    await name.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd]),
  ).toEqual([8, 8]);
  expect(await name.evaluate((node) => getComputedStyle(node).caretColor)).toBe(
    'rgb(120, 226, 189)',
  );
  await page.screenshot({ path: '/tmp/jsfather-brand-editing.png', animations: 'disabled' });
});

test('save on blur, cancel with Escape, handle Persian names, and keep the last name for empty drafts', async ({
  page,
}) => {
  await page.goto('/');
  const name = page.getByRole('textbox', { name: 'University name' });
  await replaceName(name, 'Akbar');
  await page.getByRole('heading', { name: 'Build your own university.' }).click();
  await expect(page.locator('.landing-footer')).toContainText('Akbar Personal University');
  await replaceName(name, 'Discard this');
  await name.press('Escape');
  await expect(name).toHaveValue('Akbar');
  await expect(page).toHaveTitle('Akbar Personal University — Build your own university');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('Akbar');
  await replaceName(name, '  دانشگاه من  ');
  await name.press('Enter');
  await expect(name).toHaveValue('دانشگاه من');
  await expect(page).toHaveTitle('دانشگاه من Personal University — Build your own university');
  await page.reload();
  await expect(name).toHaveValue('دانشگاه من');
  await replaceName(name, '');
  await name.press('Enter');
  await expect(name).toHaveValue('دانشگاه من');
  await expect(page).toHaveTitle('دانشگاه من Personal University — Build your own university');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('دانشگاه من');
  await replaceName(name, '   ');
  await page.getByRole('heading', { name: 'Build your own university.' }).click();
  await expect(name).toHaveValue('دانشگاه من');
  await page.reload();
  await expect(name).toHaveValue('دانشگاه من');
  await replaceName(name, 'JSFather');
  await name.press('Enter');
  await expect(name).toHaveValue('jsfather');
});

test('saved branding never renders the default name while hydration is delayed', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, 'دانشگاه اکبر');
  }, storageKey);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/**/*.js*', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle('دانشگاه اکبر Personal University — Build your own university');
    // Only the placeholder exists at this point; no React bundle has loaded.
    await expect(page.locator('.brand-name-input')).toHaveValue('');
    await expect(page.locator('.brand-name-input')).toBeHidden();
    await expect(page.locator('.landing-footer')).not.toContainText('jsfather');
    release();
    const name = page.getByRole('textbox', { name: 'University name' });
    await expect(name).toHaveValue('دانشگاه اکبر');
    await expect(name).toBeVisible();
    await expect(page).toHaveTitle('دانشگاه اکبر Personal University — Build your own university');
    await replaceName(name, 'Nahid');
    await name.press('Enter');
    await expect(page).toHaveTitle('Nahid Personal University — Build your own university');
    await page.goto('/login');
    await expect(page).toHaveTitle('Welcome back — Nahid Personal University');
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test('blocked storage reads still resolve the name and title without hydration errors', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const name = page.getByRole('textbox', { name: 'University name' });
  await expect(name).toHaveValue('jsfather');
  await expect(name).toBeVisible();
  await replaceName(name, '');
  await name.press('Enter');
  await expect(name).toHaveValue('jsfather');
  await expect(page).toHaveTitle('jsfather Personal University — Build your own university');
  expect(errors).toEqual([]);
});

test('synchronize tabs while keeping the name private to each browser', async ({
  page,
  context,
  browser,
}) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/login');
  await replaceName(page.getByRole('textbox', { name: 'University name' }), 'Akbar');
  await page.getByRole('textbox', { name: 'University name' }).press('Enter');
  await expect(second.getByRole('textbox', { name: 'University name' })).toHaveValue('Akbar');
  await expect(second).toHaveTitle('Welcome back — Akbar Personal University');
  await replaceName(second.getByRole('textbox', { name: 'University name' }), 'Nahid');
  await second.getByRole('textbox', { name: 'University name' }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'University name' })).toHaveValue('Nahid');
  await expect(page).toHaveTitle('Nahid Personal University — Build your own university');
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(page.url());
  await expect(other.getByRole('textbox', { name: 'University name' })).toHaveValue('jsfather');
  await expect(other).toHaveTitle('jsfather Personal University — Build your own university');
  await fresh.close();
  await second.close();
});

test('long names fit mobile and blocked storage still permits renaming', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const name = page.getByRole('textbox', { name: 'University name' });
  await replaceName(name, 'My Very Long Personal University Name');
  await name.press('Enter');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '/tmp/jsfather-brand-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage is unavailable', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, storageKey);
  await replaceName(name, 'Temporary campus');
  await name.press('Enter');
  await expect(name).toHaveValue('Temporary campus');
  await expect(page).toHaveTitle(
    'Temporary campus Personal University — Build your own university',
  );
  await expect(page.getByRole('status')).toContainText('Your browser couldn’t save this name');
});

test('names containing the canonical title stay stable across updates and reloads', async ({
  page,
}) => {
  await page.goto('/login');
  const name = page.getByRole('textbox', { name: 'University name' });
  await replaceName(name, 'jsfather Personal University Club');
  await name.press('Enter');
  await expect(page).toHaveTitle(
    'Welcome back — jsfather Personal University Club Personal University',
  );
  await replaceName(name, 'Another campus');
  await name.press('Enter');
  await expect(page).toHaveTitle('Welcome back — Another campus Personal University');
  await page.reload();
  await expect(page).toHaveTitle('Welcome back — Another campus Personal University');
});
