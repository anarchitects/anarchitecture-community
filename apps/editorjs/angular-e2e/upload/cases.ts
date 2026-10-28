import { test, expect } from '../hydration/fixture.js';
import type { Locator, Page } from '@playwright/test';

const editor = (page: Page, name: string) =>
  page.locator(`aa-upload-editor[data-owner="${name}"]`);
async function ready(page: Page) {
  await expect(editor(page, 'A').getByTestId('ready')).toHaveText('ready');
  await expect(editor(page, 'B').getByTestId('ready')).toHaveText('ready');
}
const upload = (owner: Locator) =>
  owner.getByRole('button', { name: 'Upload URL', exact: true }).click();
async function save(owner: Locator) {
  await owner.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(owner.getByTestId('saved')).toContainText('blocks');
  return JSON.parse(await owner.getByTestId('saved').innerText());
}

export function uploadCases(path: string) {
  test('two standalone owners share a backend but isolate concurrent uploads and retry attempts', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page, 'A');
    const b = editor(page, 'B');
    await a.getByLabel('Image purpose').selectOption('description');
    await a
      .getByLabel('Alternative text', { exact: true })
      .fill('Authored alternative');
    await b.getByLabel('Image purpose').selectOption('decorative');
    await upload(a);
    await upload(a);
    await expect(a.getByTestId('active')).toHaveText('2');
    await expect(b.getByTestId('active')).toHaveText('0');
    await page.getByLabel('Next outcome').selectOption('retry');
    await upload(b);
    await expect(b.getByTestId('operation')).toHaveText(
      'url active attempts=2',
    );
    await expect(b.getByTestId('active')).toHaveText('1');
    await expect(page.getByTestId('backend-calls')).toHaveText('4');
    await page.getByRole('button', { name: 'Release uploads' }).click();
    await expect(a.getByTestId('active')).toHaveText('0');
    await expect(b.getByTestId('active')).toHaveText('0');
    await expect(a.locator('img')).toBeVisible();
    await expect(b.locator('img')).toBeVisible();
    expect((await save(a)).blocks[0].data).toMatchObject({
      alt: 'Authored alternative',
      caption: 'Visible caption',
      file: { kind: 'url', metadata: { stored: true } },
    });
    expect((await save(b)).blocks[0].data.alt).toBe('');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(a.getByTestId('operation')).toHaveCount(0);
  });

  test('expected failure and exception remain safe, acknowledged separately, and recover without editor errors', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page, 'A');
    const b = editor(page, 'B');
    for (const [mode, status] of [
      ['failure', 'failure'],
      ['exception', 'exception'],
    ]) {
      await page.getByLabel('Next outcome').selectOption(mode);
      await upload(a);
      await expect(a.getByTestId('operation').last()).toContainText(
        `url ${status} attempts=1`,
      );
    }
    await expect(a.getByRole('alert')).toHaveCount(2);
    await expect(b.getByRole('alert')).toHaveCount(0);
    await expect(
      page.getByText('Couldn’t upload image. Please try another.', {
        exact: true,
      }),
    ).toHaveCount(2);
    await expect(a.getByTestId('editor-error')).toBeEmpty();
    await expect(page.locator('body')).not.toContainText('PRIVATE_');
    await page.getByLabel('Next outcome').selectOption('success');
    await upload(a);
    await expect(a.locator('img')).toBeVisible();
    await expect(a.getByRole('alert')).toHaveCount(2);
    await a
      .getByRole('button', { name: 'Acknowledge', exact: true })
      .first()
      .click();
    await expect(a.getByRole('alert')).toHaveCount(1);
    await a.getByRole('button', { name: 'Acknowledge', exact: true }).click();
    await expect(a.getByRole('alert')).toHaveCount(0);
    expect((await save(a)).blocks[0].data).not.toHaveProperty('alt');
  });

  test('file selection uses the same owner and preserves caption and authored alt', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page, 'A');
    await a.getByLabel('Image purpose').selectOption('description');
    await a
      .getByLabel('Alternative text', { exact: true })
      .fill('Uploaded picture');
    const chooser = page.waitForEvent('filechooser');
    await a.locator('.cdx-button').click();
    await (
      await chooser
    ).setFiles({
      name: 'picture.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"/>',
      ),
    });
    await expect(a.getByTestId('operation')).toHaveText(
      'file active attempts=1',
    );
    await expect(editor(page, 'B').getByTestId('active')).toHaveText('0');
    await page.getByRole('button', { name: 'Release uploads' }).click();
    await expect(a.locator('img')).toBeVisible();
    await expect(a.getByTestId('active')).toHaveText('0');
    expect((await save(a)).blocks[0].data).toMatchObject({
      alt: 'Uploaded picture',
      caption: 'Visible caption',
      file: { kind: 'file' },
    });
  });

  for (const outcome of ['held-success', 'held-failure', 'held-exception']) {
    for (const replacement of [
      'same-value replacement',
      'destruction/remount',
    ]) {
      test(`late ${outcome} after ${replacement} cannot revive the old owner or affect its sibling`, async ({
        page,
      }) => {
        await page.goto(path);
        await ready(page);
        const a = editor(page, 'A');
        const b = editor(page, 'B');
        await page.getByLabel('Next outcome').selectOption(outcome);
        await upload(a);
        await expect(a.getByTestId('active')).toHaveText('1');
        await page.getByLabel('Next outcome').selectOption('held-success');
        await upload(b);
        await expect(b.getByTestId('active')).toHaveText('1');
        if (replacement === 'same-value replacement') {
          await page
            .getByRole('button', { name: 'Replace A with same document' })
            .click();
        } else {
          await page.getByRole('button', { name: 'Toggle A' }).click();
          await expect(a).toHaveCount(0);
          await page.getByRole('button', { name: 'Toggle A' }).click();
        }
        await ready(page);
        await expect(a.getByTestId('active')).toHaveText('0');
        await expect(b.getByTestId('active')).toHaveText('1');
        await page.getByRole('button', { name: 'Release uploads' }).click();
        await expect(page.getByTestId('backend-completed')).toHaveText('2');
        await expect(b.getByTestId('active')).toHaveText('0');
        await expect(b.locator('img')).toBeVisible();
        await expect(a.getByTestId('operation')).toHaveCount(0);
        await expect(a.locator('.image-tool--filled')).toHaveCount(0);
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(
          page.getByText('Couldn’t upload image. Please try another.', {
            exact: true,
          }),
        ).toHaveCount(0);
        await page.getByLabel('Next outcome').selectOption('success');
        await upload(a);
        await expect(a.locator('img')).toBeVisible();
        await expect(a.getByTestId('editor-error')).toBeEmpty();
      });
    }
  }
}
