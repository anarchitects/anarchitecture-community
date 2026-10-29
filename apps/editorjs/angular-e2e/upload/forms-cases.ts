import { test, expect } from '../hydration/fixture.js';
import type { Locator, Page } from '@playwright/test';
const editor = (page: Page, name = 'A') =>
  page.locator(`aa-forms-upload-editor[data-owner="${name}"]`);
const button = (owner: Locator, name: string) =>
  owner.getByRole('button', { name, exact: true });
const upload = (owner: Locator) => button(owner, 'Upload URL').click();
async function ready(page: Page) {
  await expect(editor(page).getByTestId('ready')).toHaveText('ready');
  await expect(editor(page, 'B').getByTestId('ready')).toHaveText('ready');
}
async function persist(owner: Locator) {
  await button(owner, 'Submit').click();
  await expect(owner.getByTestId('flags')).toContainText('submitting=true');
  const data = JSON.parse(await owner.getByTestId('saved').innerText());
  await button(owner, 'Accept submission').click();
  await expect(owner.getByTestId('result')).toHaveText('Submitted');
  return data;
}
export function formsUploadCases(path: string) {
  test('concurrent uploads block submit without claiming validation pending; owners and retries are independent', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page),
      b = editor(page, 'B');
    await a.getByLabel('Image purpose').selectOption('description');
    await a
      .getByLabel('Alternative text', { exact: true })
      .fill('Authored alternative');
    await b.getByLabel('Image purpose').selectOption('decorative');
    await upload(a);
    await upload(a);
    await expect(a.getByTestId('active')).toHaveText('2');
    await expect(a.getByTestId('flags')).toContainText(
      'pending=false submitting=false',
    );
    await expect(a.getByRole('region')).toHaveAttribute('aria-busy', 'true');
    await button(a, 'Programmatic submit').click();
    await expect(a.getByTestId('persist-count')).toHaveText('0');
    await expect(a.getByTestId('result')).toHaveText(
      'Uploads block submission',
    );
    await page.getByLabel('Next outcome').selectOption('retry');
    await upload(b);
    await expect(b.getByTestId('operation')).toContainText('attempts=2');
    await page.getByRole('button', { name: 'Release uploads' }).click();
    await expect(a.locator('img')).toBeVisible();
    await expect(b.locator('img')).toBeVisible();
    await expect(a.getByTestId('flags')).toContainText('dirty=true');
    expect((await persist(a)).blocks[0].data).toMatchObject({
      alt: 'Authored alternative',
      caption: 'Visible caption',
      file: { kind: 'url', metadata: { stored: true } },
    });
    expect((await persist(b)).blocks[0].data.alt).toBe('');
    await expect(a.getByTestId('flags')).toContainText(
      'dirty=true touched=true pending=false submitting=false locked=false',
    );
  });
  test('failure aggregation composes with required and server errors; retry success requires explicit acknowledgement', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page);
    await page.getByLabel('Next outcome').selectOption('success');
    await upload(a);
    await expect(a.locator('img')).toBeVisible();
    await expect(a.getByTestId('flags')).toContainText('dirty=true');
    await button(a, 'Submit').click();
    await expect(a.getByTestId('flags')).toContainText('submitting=true');
    await button(a, 'Reject submission').click();
    await expect(a.getByRole('alert')).toContainText('server: Save failed');
    for (const mode of ['failure', 'exception']) {
      await page.getByLabel('Next outcome').selectOption(mode);
      await upload(a);
    }
    await expect(a.getByRole('alert')).toHaveCount(3);
    await expect(a.getByTestId('editor-error')).toBeEmpty();
    await expect(page.locator('body')).not.toContainText('PRIVATE_');
    await button(a, 'Acknowledge').first().click();
    await expect(a.getByRole('alert')).toHaveCount(2);
    await expect(
      a.getByRole('alert').filter({ hasText: 'server:' }),
    ).toHaveCount(1);
    await expect(a.getByTestId('flags')).toContainText(
      'dirty=true touched=true',
    );
    await a.getByLabel('Title', { exact: true }).fill('');
    await expect(
      a.getByRole('alert').filter({ hasText: 'required:' }),
    ).toHaveCount(1);
    await page.getByLabel('Next outcome').selectOption('success');
    await upload(a);
    await expect(a.getByTestId('active')).toHaveText('0');
    await expect(a.getByRole('alert')).toHaveCount(2);
    await button(a, 'Acknowledge').click();
    await expect(a.getByRole('alert')).toHaveCount(1);
    await expect(a.getByRole('alert')).toContainText('required:');
    await a.getByLabel('Title', { exact: true }).fill('Recovered');
    expect((await persist(a)).blocks[0].data).not.toHaveProperty('alt');
  });
  test('real file upload retains caption, metadata and authored alt through form submission', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page);
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
    await expect(a.getByTestId('operation')).toContainText('file active');
    await page.getByRole('button', { name: 'Release uploads' }).click();
    await expect(a.locator('img')).toBeVisible();
    expect((await persist(a)).blocks[0].data).toMatchObject({
      alt: 'Uploaded picture',
      caption: 'Visible caption',
      file: { kind: 'file', metadata: { stored: true } },
    });
  });
  test('pending validation blocks rather than waits, and duplicate capture/submission attempts are fenced', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page);
    await page.getByLabel('Next outcome').selectOption('success');
    await upload(a);
    await expect(a.locator('img')).toBeVisible();
    await button(a, 'Start validation').click();
    await expect(a.getByTestId('flags')).toContainText('pending=true');
    await button(a, 'Programmatic submit').click();
    await expect(a.getByTestId('result')).toHaveText('Submission blocked');
    await expect(a.getByTestId('flags')).toContainText(
      'submitting=false locked=false',
    );
    await expect(a.getByTestId('persist-count')).toHaveText('0');
    await button(a, 'Accept validation').click();
    await expect(a.getByTestId('flags')).toContainText('pending=false');
    await button(a, 'Hold snapshot').click();
    await button(a, 'Submit').click();
    await expect(a.getByTestId('snapshot-held')).toHaveText('true');
    await expect(a.getByTestId('flags')).toContainText(
      'submitting=false locked=true',
    );
    await button(a, 'Programmatic submit').click();
    await a
      .getByRole('button', { name: 'Upload URL', exact: true })
      .dispatchEvent('click');
    await expect(page.getByTestId('backend-calls')).toHaveText('1');
    await button(a, 'Release snapshot').click();
    await expect(a.getByTestId('flags')).toContainText(
      'submitting=true locked=true',
    );
    await button(a, 'Programmatic submit').click();
    await expect(a.getByTestId('persist-count')).toHaveText('1');
    await button(a, 'Accept submission').click();
    await expect(a.getByTestId('result')).toHaveText('Submitted');
    await button(a, 'Fail snapshot').click();
    await button(a, 'Submit').click();
    await expect(a.getByTestId('result')).toHaveText('Snapshot failed');
    await expect(a.getByTestId('flags')).toContainText('locked=false');
  });
  test('overflow remains a native blocking error until explicitly acknowledged', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page);
    await page.getByLabel('Next outcome').selectOption('failure');
    await button(a, 'Fill failure history').click();
    await expect(a.getByRole('alert')).toHaveCount(101);
    await button(a, 'Programmatic submit').click();
    await expect(a.getByTestId('persist-count')).toHaveText('0');
    await button(a, 'Acknowledge overflow').click();
    await expect(a.getByRole('alert')).toHaveCount(100);
    await expect(a.getByTestId('flags')).toContainText(
      'dirty=false touched=false pending=false',
    );
    await button(a, 'Reset same value').click();
    await ready(page);
    await expect(a.getByRole('alert')).toHaveCount(0);
  });
  test('same-value reset during a held snapshot fences the old submission', async ({
    page,
  }) => {
    await page.goto(path);
    await ready(page);
    const a = editor(page);
    await page.getByLabel('Next outcome').selectOption('success');
    await upload(a);
    await expect(a.locator('img')).toBeVisible();
    await button(a, 'Hold snapshot').click();
    await button(a, 'Submit').click();
    await expect(a.getByTestId('snapshot-held')).toHaveText('true');
    await button(a, 'Reset same value').click();
    await ready(page);
    await expect(a.getByTestId('flags')).toContainText(
      'dirty=false touched=false pending=false submitting=false locked=false',
    );
    await expect(a.getByTestId('persist-count')).toHaveText('0');
    await expect(a.getByTestId('editor-error')).toBeEmpty();
  });
  for (const mode of ['disabled', 'readonly']) {
    test(`${mode} preserves native state and prevents upload and submission`, async ({
      page,
    }) => {
      await page.goto(path);
      await ready(page);
      const a = editor(page);
      await button(a, `Toggle ${mode}`).click();
      await expect(button(a, 'Upload URL')).toBeDisabled();
      await button(a, 'Programmatic submit').click();
      await button(a, 'Upload URL').dispatchEvent('click');
      await expect(page.getByTestId('backend-calls')).toHaveText('0');
      await expect(a.getByTestId('persist-count')).toHaveText('0');
      await expect(a.getByTestId('flags')).toContainText(
        'dirty=false touched=false',
      );
      await button(a, `Toggle ${mode}`).click();
      await expect(button(a, 'Upload URL')).toBeEnabled();
      await upload(a);
      await expect(a.getByTestId('active')).toHaveText('1');
    });
  }
  for (const outcome of ['held-success', 'held-failure', 'held-exception']) {
    for (const reset of ['Reset', 'Reset same value', 'destruction']) {
      test(`${outcome} after ${reset} cannot mutate the replacement form`, async ({
        page,
      }) => {
        await page.goto(path);
        await ready(page);
        const a = editor(page),
          b = editor(page, 'B');
        await page.getByLabel('Next outcome').selectOption(outcome);
        await upload(a);
        await expect(a.getByTestId('active')).toHaveText('1');
        await page.getByLabel('Next outcome').selectOption('held-success');
        await upload(b);
        if (reset === 'destruction') {
          await page.getByRole('button', { name: 'Toggle A' }).click();
          await expect(a).toHaveCount(0);
          await page.getByRole('button', { name: 'Toggle A' }).click();
        } else await button(a, reset).click();
        await ready(page);
        await expect(a.getByTestId('flags')).toContainText(
          'dirty=false touched=false pending=false submitting=false',
        );
        await page.getByRole('button', { name: 'Release uploads' }).click();
        await expect(page.getByTestId('backend-completed')).toHaveText('2');
        await expect(b.locator('img')).toBeVisible();
        await expect(a.locator('.image-tool--filled')).toHaveCount(0);
        await expect(a.getByTestId('operation')).toHaveCount(0);
        await expect(a.getByRole('alert')).toHaveCount(0);
        await expect(
          page.getByText('Couldn’t upload image. Please try another.', {
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(a.getByTestId('flags')).toContainText(
          'dirty=false touched=false',
        );
        await page.getByLabel('Next outcome').selectOption('success');
        await upload(a);
        await expect(a.locator('img')).toBeVisible();
        await persist(a);
      });
    }
  }
}
