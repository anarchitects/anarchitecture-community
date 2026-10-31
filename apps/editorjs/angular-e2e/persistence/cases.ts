import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use();
      // eslint-disable-next-line playwright/no-standalone-expect
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});
const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
const output = (page: Page, name: string) =>
  page.getByLabel(name, { exact: true });
const text = (page: Page) => page.locator('.ce-paragraph');

export function notebookCases(forms: boolean) {
  test.describe('archived notebook persistence', () => {
    test.skip(
      !process.env['EDITORJS_PACKED_ROOT'],
      'Requires the archived application recipe',
    );
    test.beforeEach(async ({ page }) => {
      await page.goto(`/?notebook=${forms ? 'forms' : 'editor'}`);
      await button(page, 'Open notebook').click();
      await expect(text(page)).toHaveText('First notebook');
      await expect(button(page, 'Save notebook')).toBeEnabled();
    });
    async function edit(page: Page, value: string) {
      await text(page).fill(value);
      await button(page, 'Save notebook').focus();
      if (forms) {
        await expect(output(page, 'Draft document')).toContainText(value);
        await expect(output(page, 'Validation pending')).toHaveText('false');
        await expect(output(page, 'Dirty')).toHaveText('true');
        await expect(output(page, 'Touched')).toHaveText('true');
      }
    }
    test('acknowledges an explicit snapshot and reloads it', async ({
      page,
    }) => {
      await edit(page, 'Acknowledged notebook');
      await button(page, 'Save notebook').click();
      await expect(page.getByRole('status')).toHaveText(
        forms ? 'Saved snapshot; form reset' : 'Saved snapshot',
      );
      const record = JSON.parse(
        await output(page, 'Acknowledged record').innerText(),
      );
      expect(record.document.blocks[0].data.text).toBe('Acknowledged notebook');
      expect(Object.keys(record).sort()).toEqual([
        'document',
        'id',
        'provenance',
        'revision',
      ]);
      if (forms) {
        await expect(output(page, 'Dirty')).toHaveText('false');
        await expect(output(page, 'Touched')).toHaveText('false');
      }
      await edit(page, 'Discard this local draft');
      await button(page, 'Reload notebook').click();
      await expect(text(page)).toHaveText('Acknowledged notebook');
      await expect(output(page, 'Revision')).toHaveText(record.revision);
    });
    test('failed and stale writes retain the draft and native interaction state', async ({
      page,
    }) => {
      const revision = await output(page, 'Revision').innerText();
      await edit(page, 'Retain on failure');
      await button(page, 'Fail next save').click();
      await button(page, 'Save notebook').click();
      await expect(page.getByRole('status')).toHaveText(
        'Save unavailable; draft retained',
      );
      await expect(text(page)).toHaveText('Retain on failure');
      await expect(output(page, 'Revision')).toHaveText(revision);
      await expect(output(page, 'Acknowledged record')).toBeEmpty();
      if (forms) {
        await expect(output(page, 'Dirty')).toHaveText('true');
        await expect(output(page, 'Touched')).toHaveText('true');
        await expect(output(page, 'Submitting')).toHaveText('false');
      }
      await button(page, 'Save notebook').click();
      await expect(page.getByRole('status')).toHaveText(
        forms ? 'Saved snapshot; form reset' : 'Saved snapshot',
      );
      const acknowledgedRevision = await output(page, 'Revision').innerText();
      await button(page, 'Simulate another writer').click();
      await expect(page.getByRole('status')).toContainText(
        'revision is now stale',
      );
      await edit(page, 'Retain on conflict');
      await button(page, 'Save notebook').click();
      await expect(page.getByRole('status')).toHaveText(
        'Save conflict; draft retained',
      );
      await expect(text(page)).toHaveText('Retain on conflict');
      await expect(output(page, 'Revision')).toHaveText(acknowledgedRevision);
      await button(page, 'Reload notebook').click();
      await expect(text(page)).toHaveText('Another writer');
    });
    test('late acknowledgement preserves newer edits and advances only the stored revision', async ({
      page,
    }) => {
      await edit(page, 'Captured first');
      await button(page, 'Hold next save').click();
      await button(page, 'Save notebook').click();
      await expect(page.getByRole('status')).toHaveText('Persisting snapshot');
      await expect(button(page, 'Save notebook')).toBeDisabled();
      if (forms) await expect(output(page, 'Submitting')).toHaveText('true');
      // Dispatch bypasses the disabled UI to exercise the host's duplicate guard.
      await button(page, 'Save notebook').dispatchEvent('click');
      await edit(page, 'Newer draft survives');
      await button(page, 'Complete held save').click();
      await expect(page.getByRole('status')).toHaveText(
        'Saved snapshot; newer edits retained',
      );
      await expect(output(page, 'Acknowledged record')).toContainText(
        'Captured first',
      );
      await expect(output(page, 'Acknowledged record')).not.toContainText(
        'Newer draft survives',
      );
      await expect(text(page)).toHaveText('Newer draft survives');
      const first = await output(page, 'Revision').innerText();
      if (forms) await expect(output(page, 'Dirty')).toHaveText('true');
      await button(page, 'Save notebook').click();
      await expect(page.getByRole('status')).toHaveText(
        forms ? 'Saved snapshot; form reset' : 'Saved snapshot',
      );
      await expect(output(page, 'Acknowledged record')).toContainText(
        'Newer draft survives',
      );
      await expect(output(page, 'Revision')).toHaveText(
        `r${Number(first.slice(1)) + 1}`,
      );
    });
    test('a new load fences a pending acknowledgement', async ({ page }) => {
      await edit(page, 'Old notebook snapshot');
      await button(page, 'Hold next save').click();
      await button(page, 'Save notebook').click();
      await expect(page.getByRole('status')).toHaveText('Persisting snapshot');
      await button(page, 'Load other notebook').click();
      await expect(text(page)).toHaveText('Second notebook');
      await expect(page.getByRole('status')).toHaveText(
        'Loaded note-2 (current)',
      );
      const revision = await output(page, 'Revision').innerText();
      await button(page, 'Complete held save').click();
      await expect(output(page, 'Persistence pending')).toHaveText('false');
      await expect(output(page, 'Loaded notebook')).toHaveText('note-2');
      await expect(output(page, 'Revision')).toHaveText(revision);
      await expect(output(page, 'Acknowledged record')).toBeEmpty();
      await expect(page.getByRole('status')).toHaveText(
        'Loaded note-2 (current)',
      );
      if (forms) await expect(output(page, 'Dirty')).toHaveText('false');
      await edit(page, 'Second owner draft');
      await button(page, 'Save notebook').click();
      await expect(output(page, 'Acknowledged record')).toContainText(
        'Second owner draft',
      );
    });
    test('unsupported loads retain content and legacy loads migrate before explicit editing', async ({
      page,
    }) => {
      await edit(page, 'Do not replace with empty');
      await button(page, 'Load unsupported notebook').click();
      await expect(page.getByRole('status')).toContainText(
        'previous draft retained',
      );
      await expect(text(page)).toHaveText('Do not replace with empty');
      await expect(button(page, 'Save notebook')).toBeDisabled();
      await button(page, 'Load legacy notebook').click();
      await expect(page.getByRole('status')).toHaveText(
        'Loaded legacy (migrated)',
      );
      await expect(page.locator('.callout-text')).toHaveText('Legacy notebook');
      await expect(output(page, 'Acknowledged record')).toBeEmpty();
      await page.locator('.callout-text').fill('Edited migrated notebook');
      if (forms)
        await expect(output(page, 'Draft document')).toContainText(
          'Edited migrated notebook',
        );
      await expect(button(page, 'Save notebook')).toBeEnabled();
      await button(page, 'Save notebook').click();
      await expect(output(page, 'Acknowledged record')).toContainText(
        'Edited migrated notebook',
      );
      const record = JSON.parse(
        await output(page, 'Acknowledged record').innerText(),
      );
      expect(record.provenance.schema.version).toBe('2');
      expect(record.document.blocks[0].type).toBe('callout');
    });
    if (forms)
      test('async review pending and rejection are independent of persistence', async ({
        page,
      }) => {
        let finish: ((accepted: boolean) => void) | undefined;
        await page.route('**/notebook-review', async (route) => {
          const accepted = await new Promise<boolean>((resolve) => {
            finish = resolve;
          });
          await route.fulfill({ json: accepted });
        });
        try {
          await page.goto('/?notebook=forms&review');
          await button(page, 'Open notebook').click();
          await expect(output(page, 'Validation pending')).toHaveText('true');
          await expect(button(page, 'Save notebook')).toBeDisabled();
          await expect(output(page, 'Persistence pending')).toHaveText('false');
          await expect(output(page, 'Submitting')).toHaveText('false');
          await expect.poll(() => Boolean(finish)).toBe(true);
          finish!(false);
          await expect(output(page, 'Validation pending')).toHaveText('false');
          await expect(page.getByRole('alert')).toHaveText(
            'Review rejected the document',
          );
          await expect(text(page)).toHaveText('First notebook');
          await expect(output(page, 'Acknowledged record')).toBeEmpty();
        } finally {
          finish?.(true);
        }
      });
  });
}
