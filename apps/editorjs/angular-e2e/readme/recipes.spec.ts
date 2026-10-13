import assert from 'node:assert/strict';
import { test as base, expect } from '@playwright/test';

const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use();
      assert.deepEqual(
        errors,
        [],
        'README hydration must not report browser errors',
      );
    },
    { auto: true },
  ],
});

for (const path of ['/edit', '/form', '/sample/edit', '/sample/form']) {
  test(`packed README hydrates and edits ${path}`, async ({ page }) => {
    let release!: () => void;
    const scripts = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/*.js', async (route) => {
      await scripts;
      await route.continue();
    });
    await page.goto(path, { waitUntil: 'commit' });
    const holder = page.locator('aa-editorjs > div');
    await expect(holder).toHaveCount(1);
    const original = await holder.elementHandle();
    assert(original);
    expect(await holder.innerHTML()).toBe('');
    release();
    const paragraph = page.locator('.ce-paragraph[contenteditable="true"]');
    await expect(paragraph).toHaveCount(1);
    expect(await original.evaluate((node) => node.isConnected)).toBe(true);
    await paragraph.fill('README hydrated edit');
    if (path.endsWith('form')) {
      await page.getByRole('button', { name: 'Toggle disabled' }).click();
      await expect(page.locator('aa-editorjs-control')).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await page.getByRole('button', { name: 'Toggle disabled' }).click();
      await expect(paragraph).toBeEditable();
    } else {
      await expect(page.getByRole('status')).toHaveText('Edited');
    }
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Articles', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.codex-editor')).toHaveCount(0);
  });
}

test('packed README ordinary defer activates the standalone example', async ({
  page,
}) => {
  await page.goto('/delayed');
  await expect(page.getByText('Activate to load the editor.')).toBeVisible();
  await expect(page.locator('aa-editorjs')).toHaveCount(0);
  await page.getByRole('button', { name: 'Activate article' }).click();
  await expect(
    page.locator('.ce-paragraph[contenteditable="true"]'),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Ready');
});

test('packed README incremental Forms boundary waits for interaction', async ({
  page,
}) => {
  await page.goto('/incremental');
  const holder = page.locator('aa-editorjs > div');
  await expect(holder).toHaveCount(1);
  const original = await holder.elementHandle();
  assert(original);
  await expect(page.locator('.codex-editor')).toHaveCount(0);
  await page.getByRole('button', { name: 'Activate article' }).click();
  await expect(
    page.locator('.ce-paragraph[contenteditable="true"]'),
  ).toBeVisible();
  expect(await original.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.locator('.codex-editor')).toHaveCount(1);
});

test('packed README remains non-submitting without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/incremental`);
    await expect(page.locator('.codex-editor')).toHaveCount(0);
    await expect(
      page.locator('form, button[type="submit"], input'),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Activate article' }).click();
    await page.getByRole('button', { name: 'Activate article' }).press('Enter');
    expect(new URL(page.url()).pathname).toBe('/incremental');
  } finally {
    await context.close();
  }
});
