import { test, expect, type Locator } from '@playwright/test';
import {
  display,
  displayResult,
  displayText,
  persistDisplay,
  surfaces,
} from './display.js';

export function commonDisplayCases() {
  test.describe('packed authoring to stored Angular display', () => {
    test.skip(
      !process.env['EDITORJS_PACKED_ROOT'],
      'Requires installed renderer archives and the archived codec',
    );
    for (const [query, selector, semantic] of [
      ['', '.ce-paragraph', 'p'],
      ['header', '.ce-header', 'h2'],
      ['list', '.cdx-list__item-content', 'ul li'],
      ['quote', '.cdx-quote__text', 'blockquote p'],
    ]) {
      test(`explicit ${query || 'paragraph'} save reaches both displays through storage`, async ({
        page,
      }) => {
        await page.goto(`/?${query}`);
        const owner = page.getByRole('region', {
          name: 'First editor',
          exact: true,
        });
        const sibling = page.getByRole('region', {
          name: 'Second editor',
          exact: true,
        });
        await expect(owner.getByRole('status')).toHaveText('Ready');
        await owner.locator(selector).fill('Authored and stored');
        await displayText(owner, '');
        await owner.getByRole('button', { name: 'Save', exact: true }).click();
        await persistDisplay(owner);
        await displayResult(owner);
        for (const surface of surfaces(owner))
          await expect(surface.locator(semantic)).toHaveText(
            'Authored and stored',
          );
        await owner.locator(selector).fill('Unsaved replacement');
        for (const surface of surfaces(owner))
          await expect(surface).not.toContainText('Unsaved replacement');
        await displayText(sibling, '');
      });
    }

    test('stored aliases, unsafe content, invalid input and preview recover without stale output', async ({
      page,
    }) => {
      await page.goto('/');
      const owner = page.getByRole('region', {
        name: 'First editor',
        exact: true,
      });
      const sibling = page.getByRole('region', {
        name: 'Second editor',
        exact: true,
      });
      await expect(owner.getByRole('status')).toHaveText('Ready');
      await owner.locator('.ce-paragraph').fill('Safe authored text');
      await owner.getByRole('button', { name: 'Save', exact: true }).click();
      await persistDisplay(owner);
      const fixture = display(owner);
      const bytes = fixture.getByLabel('Stored bytes');
      const stored = JSON.parse(await bytes.inputValue());
      stored.blocks[0].type = 'copy';
      await bytes.fill(JSON.stringify(stored));
      await fixture
        .getByRole('button', { name: 'Load stored display' })
        .click();
      await displayText(owner, 'Safe authored text');
      // Structurally valid storage is not a publication or HTML safety decision.
      stored.blocks.push({
        type: 'paragraph',
        data: {
          text: '<script>window.packedAttack = true</script><b>Safe remainder</b>',
        },
      });
      await bytes.fill(JSON.stringify(stored));
      await fixture
        .getByRole('button', { name: 'Load stored display' })
        .click();
      await expect(fixture.getByLabel('Display receipt')).toHaveText(
        'Stored snapshot loaded',
      );
      const strict = await displayResult(owner, 'failure');
      expect(strict.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'unsafe_html' }),
        ]),
      );
      for (const surface of surfaces(owner)) await expect(surface).toBeEmpty();
      await fixture.getByRole('button', { name: 'Preview display' }).click();
      await displayResult(owner, 'preview');
      for (const surface of surfaces(owner)) {
        await expect(surface).toContainText('Safe authored text');
        await expect(surface.locator('script')).toHaveCount(0);
      }
      expect(await page.evaluate(() => 'packedAttack' in window)).toBe(false);
      await displayText(sibling, '');
      await bytes.fill('{bad json');
      await fixture
        .getByRole('button', { name: 'Load stored display' })
        .click();
      await expect(fixture.getByLabel('Display receipt')).toHaveText(
        'Invalid stored data',
      );
      await displayResult(owner, 'failure');
      for (const surface of surfaces(owner)) await expect(surface).toBeEmpty();
      await fixture.getByRole('button', { name: 'Strict display' }).click();
      await persistDisplay(owner);
      await displayText(owner, 'Safe authored text');
    });
  });
}

export function formsDisplayCases() {
  test.describe('packed native Forms snapshot to display', () => {
    test.skip(
      !process.env['EDITORJS_PACKED_ROOT'],
      'Requires the packed composition fixture',
    );
    test('an explicit snapshot survives later model replacement without leaking into its sibling', async ({
      page,
    }) => {
      await page.goto('/?forms');
      const owner = page.getByRole('region', {
        name: 'First form',
        exact: true,
      });
      const sibling = page.getByRole('region', {
        name: 'Second form',
        exact: true,
      });
      await expect(owner.getByRole('status')).toHaveText('Ready');
      await owner.locator('.ce-paragraph').fill('Native form snapshot');
      // Wait for the native field to observe the edit before testing retention.
      await expect(owner.getByTestId('dirty')).toHaveText('true');
      await expect(
        owner.getByLabel('Model document', { exact: true }),
      ).toContainText('Native form snapshot');
      await owner.getByRole('button', { name: 'Capture', exact: true }).click();
      await expect(owner.getByTestId('result')).toHaveText('Captured');
      await persistDisplay(owner);
      await displayText(owner, 'Native form snapshot');
      await owner
        .getByRole('button', { name: 'Replace value', exact: true })
        .click();
      await expect(owner.locator('.ce-paragraph')).toHaveText(
        'First replacement',
      );
      // A model write is not a form reset; interaction state must survive it.
      await expect(owner.getByTestId('dirty')).toHaveText('true');
      await displayText(owner, 'Native form snapshot');
      await displayText(sibling, '');
      await owner.getByRole('button', { name: 'Capture', exact: true }).click();
      await persistDisplay(owner);
      await displayText(owner, 'First replacement');
      await owner.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(owner.locator('.ce-paragraph')).toHaveText('First reset');
      await expect(owner.getByTestId('dirty')).toHaveText('false');
      await displayText(owner, 'First replacement');
    });
  });
}

export function uploadDisplayCases(forms: boolean) {
  test.describe(`packed ${forms ? 'Forms' : 'standalone'} upload to display`, () => {
    test.skip(
      !process.env['EDITORJS_PACKED_ROOT'],
      'Requires the packed composition fixture',
    );
    test('upload is not persistence; three alt states, failure and teardown retain owner boundaries', async ({
      page,
    }) => {
      await page.goto(forms ? '/?forms-upload' : '/?upload');
      const tag = forms ? 'aa-forms-upload-editor' : 'aa-upload-editor';
      const owner = page.locator(`${tag}[data-owner="A"]`);
      const sibling = page.locator(`${tag}[data-owner="B"]`);
      await expect(owner.getByTestId('ready')).toHaveText('ready');
      await expect(sibling.getByTestId('ready')).toHaveText('ready');
      const capture = async (target: Locator) => {
        await target
          .getByRole('button', { name: forms ? 'Submit' : 'Save', exact: true })
          .click();
        if (forms) {
          await expect(target.getByTestId('flags')).toContainText(
            'submitting=true',
          );
          await target
            .getByRole('button', { name: 'Accept submission', exact: true })
            .click();
          await expect(target.getByTestId('result')).toHaveText('Submitted');
        }
        await expect(target.getByTestId('saved')).toContainText('blocks');
      };
      await owner.getByRole('button', { name: 'Upload URL' }).click();
      await expect(owner.getByTestId('active')).toHaveText('1');
      await displayText(owner, '');
      await page.getByRole('button', { name: 'Release uploads' }).click();
      await expect(owner.getByTestId('active')).toHaveText('0');
      await expect(owner.locator('.image-tool img')).toBeVisible();
      await displayText(owner, '');
      await expect(display(owner).getByLabel('Stored bytes')).toHaveValue('');
      await capture(owner);
      await persistDisplay(owner);
      const missing = await displayResult(owner, 'failure');
      expect(missing.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'missing_alt' }),
        ]),
      );
      for (const surface of surfaces(owner)) await expect(surface).toBeEmpty();
      await display(owner)
        .getByRole('button', { name: 'Preview display' })
        .click();
      await displayResult(owner, 'preview');
      for (const surface of surfaces(owner))
        await expect(surface.locator('img')).toHaveCount(0);
      await display(owner)
        .getByRole('button', { name: 'Strict display' })
        .click();
      for (const alt of ['', 'A "literal" <alt>']) {
        await owner
          .getByLabel('Image purpose')
          .selectOption(alt ? 'description' : 'decorative');
        if (alt)
          await owner.getByLabel('Alternative text', { exact: true }).fill(alt);
        await capture(owner);
        await persistDisplay(owner);
        await displayResult(owner);
        for (const surface of surfaces(owner)) {
          await expect(surface.locator('img')).toHaveAttribute('alt', alt);
          await expect(surface.locator('figcaption')).toHaveText(
            'Visible caption',
          );
        }
      }
      const acknowledged = await display(owner)
        .getByLabel('Stored bytes')
        .inputValue();
      await page.getByLabel('Next outcome').selectOption('failure');
      await owner.getByRole('button', { name: 'Upload URL' }).click();
      await expect(owner.getByTestId('operation')).toContainText('failure');
      await expect(display(owner).getByLabel('Stored bytes')).toHaveValue(
        acknowledged,
      );
      await displayResult(owner);
      await displayText(sibling, '');
      await page.getByLabel('Next outcome').selectOption('held-success');
      await owner.getByRole('button', { name: 'Upload URL' }).click();
      await expect(owner.getByTestId('active')).toHaveText('1');
      await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
      await expect(owner).toHaveCount(0);
      await page.getByRole('button', { name: 'Release uploads' }).click();
      await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
      await expect(owner.getByTestId('ready')).toHaveText('ready');
      await displayText(owner, '');
      await displayText(sibling, '');
      await expect(display(owner).getByLabel('Stored bytes')).toHaveValue('');
    });
  });
}
