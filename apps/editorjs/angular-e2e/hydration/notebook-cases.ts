import { test, expect, bootstrap } from './fixture.js';
import { packed } from '../tools/ssr-environment.mjs';

export function notebookHydrationCases() {
  test.describe('archived notebook hydration', () => {
    test.skip(!packed, 'Requires the archived application recipe');
    for (const forms of [false, true]) {
      test(`${forms ? 'Forms' : 'standalone'} fences prehydration actions and disposed persistence`, async ({
        page,
      }) => {
        const path = forms ? '/notebook-forms' : '/notebook';
        const open = page.getByRole('button', {
          name: 'Open notebook',
          exact: true,
        });
        const save = page.getByRole('button', {
          name: 'Save notebook',
          exact: true,
        });
        const writes: string[] = [];
        page.on('request', (request) => {
          if (request.method() === 'POST') writes.push(request.url());
        });
        await bootstrap(
          page,
          `${path}?marker=notebook-request`,
          [],
          0,
          async () => {
            await expect(open).toBeDisabled();
            await expect(page.locator('form, .codex-editor')).toHaveCount(0);
            const box = await open.boundingBox();
            expect(box).not.toBeNull();
            await page.mouse.click(box!.x + 5, box!.y + 5);
            await page.keyboard.press('Enter');
            await expect(page).toHaveURL(
              new RegExp(`${path}\\?marker=notebook-request$`),
            );
          },
        );
        await expect(open).toBeEnabled();
        await expect(page.locator('.codex-editor')).toHaveCount(0);
        expect(
          await page.evaluate(() =>
            window.hydrationTest.nodes.every((node) => node.isConnected),
          ),
        ).toBe(true);
        await open.click();
        const paragraph = page.locator('.ce-paragraph');
        await expect(paragraph).toHaveText('First notebook');
        await paragraph.fill('Hydrated notebook draft');
        if (forms)
          await expect(
            page.getByLabel('Draft document', { exact: true }),
          ).toContainText('Hydrated notebook draft');
        await expect(save).toBeEnabled();
        await save.click();
        await expect(
          page.getByLabel('Acknowledged record', { exact: true }),
        ).toContainText('Hydrated notebook draft');
        await page
          .getByRole('button', { name: 'Hold next save', exact: true })
          .click();
        await save.click();
        await expect(page.getByRole('status')).toHaveText(
          'Persisting snapshot',
        );
        await page.getByRole('link', { name: 'Public', exact: true }).click();
        await expect(page.locator('.codex-editor')).toHaveCount(0);
        await page
          .getByRole('link', {
            name: forms ? 'Notebook Forms' : 'Notebook',
            exact: true,
          })
          .click();
        await expect(page.locator('.codex-editor')).toHaveCount(0);
        await open.click();
        await expect(paragraph).toHaveText('First notebook');
        await expect(
          page.getByLabel('Acknowledged record', { exact: true }),
        ).toBeEmpty();
        if (forms) {
          await expect(page.getByLabel('Dirty', { exact: true })).toHaveText(
            'false',
          );
          await expect(page.getByLabel('Touched', { exact: true })).toHaveText(
            'false',
          );
        }
        expect(writes).toEqual([]);
      });
    }
  });
}
