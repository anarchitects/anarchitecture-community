import { test as base, expect, type Locator } from '@playwright/test';

const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use();
      // Fixture teardown is part of each test, after its browser interactions.
      // eslint-disable-next-line playwright/no-standalone-expect
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});
const save = (owner: Locator) =>
  owner.getByRole('button', { name: 'Save', exact: true }).click();
const saved = (owner: Locator) =>
  owner.getByLabel('Saved document', { exact: true });

export function customEditorCases() {
  test.describe('archived Angular custom tools', () => {
    test.skip(
      !process.env['EDITORJS_PACKED_ROOT'],
      'Requires the actual packed guide extracted by preparation',
    );
    for (const mode of ['Direct', 'Provider']) {
      test(`${mode} composes the archived block, inline, tune and third-party Code`, async ({
        page,
      }) => {
        await page.goto('/?custom=editors');
        const owner = page.getByRole('region', {
          name: `${mode} editor`,
          exact: true,
        });
        const other = page.getByRole('region', {
          name: `${mode === 'Direct' ? 'Provider' : 'Direct'} editor`,
          exact: true,
        });
        await expect(owner.getByRole('status')).toHaveText('Ready');
        await expect(other.getByRole('status')).toHaveText('Ready');
        await expect(owner).toContainText('callout,marker,flag,code');
        const text = owner.getByRole('textbox', {
          name: mode === 'Direct' ? 'direct explicit' : 'provider selected',
          exact: true,
        });
        await text.fill(`${mode} changed`);
        await text.selectText();
        await text.dispatchEvent('mouseup', { bubbles: true });
        await owner
          .getByRole('button', { name: 'Highlight text', exact: true })
          .click();
        await expect(text.locator('mark')).toHaveText(`${mode} changed`);
        await text.click();
        await text.hover();
        await owner.locator('.ce-toolbar__settings-btn').click();
        await owner.getByText('Flag for review', { exact: true }).click();
        await expect(owner.locator('.callout-flag')).toHaveAttribute(
          'data-flagged',
          'true',
        );
        const code = owner.locator('textarea.ce-code__textarea');
        await expect(code).toHaveCSS('min-height', '200px');
        await code.click();
        await code.fill('<script>literal</script>');
        await save(owner);
        await expect(saved(owner)).toContainText('<script>literal</script>');
        const doc = JSON.parse(await saved(owner).innerText());
        expect(doc.blocks[0].data.text).toContain('<mark>');
        expect(doc.blocks[0].tunes.flag).toEqual({ flagged: true });
        expect(doc.blocks[1].data.code).toBe('<script>literal</script>');
        await code.fill('Temporary');
        await owner
          .getByRole('button', { name: 'Reload', exact: true })
          .click();
        await expect(owner.getByRole('status')).toHaveText('Reloaded');
        await expect(code).toHaveValue('<script>literal</script>');
        await expect(owner.locator('.callout-flag')).toHaveAttribute(
          'data-flagged',
          'true',
        );
        await owner.getByRole('button', { name: 'Toggle readonly' }).click();
        await expect(owner.getByRole('status')).toHaveText('Read only');
        await expect(code).toBeDisabled();
        await expect(text).not.toBeEditable();
        await expect(other.locator('.callout-flag')).toHaveAttribute(
          'data-flagged',
          'false',
        );
        await expect(other.locator('.callout-text')).toContainText('callout');
        await page
          .getByRole('button', {
            name: `Remove ${mode.toLowerCase()}`,
            exact: true,
          })
          .click();
        await expect(owner.locator('.codex-editor')).toHaveCount(0);
        await expect(other.locator('.codex-editor')).toHaveCount(1);
        await page
          .getByRole('button', {
            name: `Remount ${mode.toLowerCase()}`,
            exact: true,
          })
          .click();
        await expect(owner.getByRole('status')).toHaveText('Ready');
        await expect(owner.locator('.callout-flag')).toHaveAttribute(
          'data-flagged',
          'false',
        );
      });
    }

    test('provider removal during Code delivery fences creation and keeps its sibling alive', async ({
      page,
    }) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let held = false;
      await page.route('**/*.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        if (body.includes('.ce-code__textarea{')) {
          held = true;
          await gate;
        }
        await route.fulfill({ response, body });
      });
      await page.goto('/?custom=editors');
      await expect.poll(() => held).toBe(true);
      await page
        .getByRole('button', { name: 'Remove provider', exact: true })
        .click();
      release();
      const direct = page.getByRole('region', {
        name: 'Direct editor',
        exact: true,
      });
      const provider = page.getByRole('region', {
        name: 'Provider editor',
        exact: true,
      });
      await expect(direct.getByRole('status')).toHaveText('Ready');
      await expect(provider).toBeEmpty();
      await page
        .getByRole('button', { name: 'Remount provider', exact: true })
        .click();
      await expect(provider.getByRole('status')).toHaveText('Ready');
    });

    test('provider module failure reports load and corrected fresh activation recovers', async ({
      page,
    }) => {
      await page.route('**/*.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        await route.fulfill({
          response,
          body: body.includes('.ce-code__textarea{')
            ? 'throw new Error("Injected custom tool failure")'
            : body,
        });
      });
      await page.goto('/?custom=editors');
      const provider = page.getByRole('region', {
        name: 'Provider editor',
        exact: true,
      });
      await expect(provider.getByRole('status')).toHaveText(
        'load: operation-failed',
      );
      await expect(provider.locator('.codex-editor')).toHaveCount(0);
      await page.unroute('**/*.js');
      await page.reload();
      await expect(provider.getByRole('status')).toHaveText('Ready');
    });
  });
}

export function customFormCases() {
  test.describe('archived custom tools with native Forms', () => {
    test.skip(
      !process.env['EDITORJS_PACKED_ROOT'],
      'Requires the actual packed guide extracted by preparation',
    );
    test.beforeEach(async ({ page }) => {
      await page.route('**/custom-review', (route) =>
        route.fulfill({ json: true }),
      );
      await page.route('**/custom-persist', (route) =>
        route.fulfill({ json: true }),
      );
      await page.goto('/?custom=forms');
      await expect(
        page.getByRole('button', { name: 'Save document' }),
      ).toBeEnabled();
    });

    test('edits, saves and resets through FormField with independent interaction and availability', async ({
      page,
    }) => {
      const owner = page.getByRole('region', { name: 'Form editor' });
      const text = owner.getByRole('textbox', {
        name: 'Forms selected',
        exact: true,
      });
      const code = owner.locator('textarea.ce-code__textarea');
      await expect(owner.getByLabel('Dirty', { exact: true })).toHaveText(
        'false',
      );
      await expect(owner.getByLabel('Touched', { exact: true })).toHaveText(
        'false',
      );
      await text.fill('Forms custom edit');
      await expect(owner.getByLabel('Dirty', { exact: true })).toHaveText(
        'true',
      );
      await owner.getByRole('button', { name: 'Save document' }).click();
      await expect(owner.getByRole('status')).toHaveText('Saved locally');
      await expect(owner.getByLabel('Touched', { exact: true })).toHaveText(
        'true',
      );
      await expect(saved(owner)).toContainText('Forms custom edit');
      await owner.getByRole('button', { name: 'Toggle disabled' }).click();
      await expect(owner.locator('aa-editorjs-control')).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await expect(code).toBeDisabled();
      await owner.getByRole('button', { name: 'Toggle disabled' }).click();
      await expect(code).toBeEnabled();
      await owner.getByRole('button', { name: 'Toggle readonly' }).click();
      await expect(owner.locator('aa-editorjs-control')).toHaveAttribute(
        'data-readonly',
        'true',
      );
      await expect(code).toBeDisabled();
      await owner.getByRole('button', { name: 'Toggle readonly' }).click();
      await owner.getByRole('button', { name: 'Reset document' }).click();
      await expect(text).toHaveText('Forms callout');
      await expect(owner.getByLabel('Dirty', { exact: true })).toHaveText(
        'false',
      );
      await expect(owner.getByLabel('Touched', { exact: true })).toHaveText(
        'false',
      );
    });

    test('async review blocks submission, server failure retains edits and a silent Code edit refreshes the snapshot', async ({
      page,
    }) => {
      const owner = page.getByRole('region', { name: 'Form editor' });
      const code = owner.locator('textarea.ce-code__textarea');
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/custom-review', async (route) => {
        await gate;
        await route.fulfill({ json: true });
      });
      await code.click();
      await code.fill('const submitted = 1;');
      await expect(
        owner.getByLabel('Validation pending', { exact: true }),
      ).toHaveText('true');
      await expect(owner.getByLabel('Submitting', { exact: true })).toHaveText(
        'false',
      );
      await expect(
        owner.getByRole('button', { name: 'Save document' }),
      ).toBeDisabled();
      await expect(code).toBeEditable();
      release();
      await expect(
        owner.getByLabel('Validation pending', { exact: true }),
      ).toHaveText('false');
      await page.route('**/custom-persist', (route) =>
        route.fulfill({ json: false }),
      );
      await owner.getByRole('button', { name: 'Save document' }).click();
      await expect(owner.getByRole('alert')).toContainText('Save failed');
      await expect(code).toHaveValue('const submitted = 1;');
      await expect(
        owner.getByLabel('Validation pending', { exact: true }),
      ).toHaveText('false');
      await code.click();
      await code.press('ControlOrMeta+End');
      await code.press('Tab');
      await expect(code).toHaveValue('const submitted = 1;  ');
      await owner.getByRole('button', { name: 'Save document' }).click();
      await expect(owner.getByRole('status')).toHaveText(
        'Snapshot refreshed; review it and save again',
      );
      await page.route('**/custom-persist', (route) =>
        route.fulfill({ json: true }),
      );
      await expect(
        owner.getByLabel('Validation pending', { exact: true }),
      ).toHaveText('false');
      await owner.getByRole('button', { name: 'Save document' }).click();
      await expect(owner.getByRole('status')).toHaveText('Saved locally');
      expect(
        JSON.parse(await saved(owner).innerText()).blocks[1].data.code,
      ).toBe('const submitted = 1;  ');
    });
  });
}
