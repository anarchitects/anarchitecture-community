import { expect, test, type Locator, type Page } from '@playwright/test';
import { customEditorCases } from '../custom/cases.js';

customEditorCases();

const card = (page: Page, name: string) =>
  page.getByRole('region', { name: `${name} editor`, exact: true });
const paragraph = (owner: Locator) => owner.locator('.ce-paragraph');
const saved = async (owner: Locator) =>
  JSON.parse(
    await owner.getByLabel('Saved document', { exact: true }).innerText(),
  );

test('activates packed quote in Angular with independent owners', async ({
  page,
}) => {
  await page.goto('/?quote');
  const first = card(page, 'First');
  const text = first.locator('.cdx-quote__text');
  const caption = first.locator('.cdx-quote__caption');
  await expect(first.getByRole('status')).toHaveText('Ready');
  await expect(text).toHaveText('First initial');
  await expect(caption).toHaveText('Attribution');
  await expect(page.locator('html')).toHaveAttribute(
    'data-quote-instances',
    /[2-9]\d*|1\d+/,
  );
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  expect((await saved(first)).blocks[0].data.alignment).toBe('left');
  await text.fill('Angular quotation');
  await caption.fill('Angular author');
  await text.click();
  await first.locator('.ce-toolbar__settings-btn').click();
  await first.getByText('Align Center', { exact: true }).click();
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  await expect
    .poll(async () => (await saved(first)).blocks)
    .toMatchObject([
      {
        type: 'quote',
        data: {
          text: 'Angular quotation',
          caption: 'Angular author',
          alignment: 'center',
        },
      },
    ]);
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(text).toHaveText('First rendered');
  await expect(caption).toHaveText('Attribution');
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(text).toHaveAttribute('contenteditable', 'false');
  await expect(caption).toHaveAttribute('contenteditable', 'false');
  await first.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(first.locator('.codex-editor')).toHaveCount(0);
  await expect(card(page, 'Second').locator('.cdx-quote__text')).toHaveText(
    'Second initial',
  );
});

test('activates packed nested list in Angular with independent owners', async ({
  page,
}) => {
  await page.goto('/?list');
  const first = card(page, 'First');
  const content = first.locator('.cdx-list__item-content');
  await expect(first.getByRole('status')).toHaveText('Ready');
  await expect(content).toHaveText('First initial');
  await expect(page.locator('html')).toHaveAttribute(
    'data-list-instances',
    /[2-9]\d*|1\d+/,
  );
  await content.fill('Angular parent');
  await content.press('End');
  await content.press('Enter');
  await content.nth(1).fill('Angular child');
  await content.nth(1).press('Tab');
  await expect(
    first.locator('.cdx-list__item-children .cdx-list__item-content'),
  ).toHaveText('Angular child');
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  expect((await saved(first)).blocks).toMatchObject([
    {
      type: 'list',
      data: {
        style: 'unordered',
        meta: {},
        items: [
          { content: 'Angular parent', items: [{ content: 'Angular child' }] },
        ],
      },
    },
  ]);
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(content).toHaveText('First rendered');
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(content).toHaveAttribute('contenteditable', 'false');
  await first.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(first.locator('.codex-editor')).toHaveCount(0);
  await expect(
    card(page, 'Second').locator('.cdx-list__item-content'),
  ).toHaveText('Second initial');
});

test('activates packed header through the standalone provider and retains independent owners', async ({
  page,
}) => {
  await page.goto('/?header');
  const first = card(page, 'First');
  const heading = first.locator('.ce-header');
  await expect(first.getByRole('status')).toHaveText('Ready');
  await expect(first.locator('h2.ce-header')).toHaveText('First initial');
  await expect(page.locator('html')).toHaveAttribute(
    'data-header-instances',
    /[2-9]\d*|1\d+/,
  );
  await expect(heading).toHaveAttribute('data-placeholder', 'Section title');
  await heading.fill('Packaged Angular heading');
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  expect((await saved(first)).blocks).toMatchObject([
    { type: 'header', data: { text: 'Packaged Angular heading', level: 2 } },
  ]);
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(first.locator('h2.ce-header')).toHaveText('First rendered');
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(heading).toHaveAttribute('contenteditable', 'false');
  await first.getByRole('button', { name: 'Read only' }).click();
  await first.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(first.locator('h2.ce-header')).toBeEmpty();
  await first.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(first.locator('.codex-editor')).toHaveCount(0);
  await expect(card(page, 'Second').locator('h2.ce-header')).toHaveText(
    'Second initial',
  );
});

test('activates the packed paragraph through the standalone registry provider', async ({
  page,
}) => {
  await page.goto('/?paragraph');
  const first = card(page, 'First');
  await expect(first.getByRole('status')).toHaveText('Ready');
  await expect(page.locator('html')).toHaveAttribute(
    'data-paragraph-instances',
    /[2-9]\d*|1\d+/,
  );
  await expect(paragraph(first)).toHaveAttribute(
    'data-placeholder-active',
    'Packaged paragraph',
  );
  await paragraph(first).fill('Packaged Angular paragraph');
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  await expect
    .poll(async () => (await saved(first)).blocks)
    .toMatchObject([
      { type: 'paragraph', data: { text: 'Packaged Angular paragraph' } },
    ]);
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(paragraph(first)).toHaveText('First rendered');
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(paragraph(first)).toHaveAttribute('contenteditable', 'false');
  await first.getByRole('button', { name: 'Read only' }).click();
  await first.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(paragraph(first)).toBeEmpty();
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(async () => (await saved(first)).blocks)
    .toMatchObject([{ type: 'paragraph', data: { text: '' } }]);
  await first.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(first.locator('.codex-editor')).toHaveCount(0);
  await expect(paragraph(card(page, 'Second'))).toHaveText('Second initial');
});

// Editor.js batches MutationObserver notifications for 400ms. Negative assertions
// deliberately observe beyond that window, after positive readiness/completion checks.
async function settleNotifications(page: Page): Promise<void> {
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(750);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.goto('/');
  await expect(card(page, 'First').getByRole('status')).toHaveText('Ready');
  await expect(card(page, 'Second').getByRole('status')).toHaveText('Ready');
});

test('mounts built packages in a zoneless host and saves real keyboard edits', async ({
  page,
}) => {
  const first = card(page, 'First');
  await expect(
    first.getByRole('group', { name: 'First editor', exact: true }),
  ).toBeVisible();
  await expect(paragraph(first)).toHaveText('First initial');
  await expect(paragraph(card(page, 'Second'))).toHaveText('Second initial');
  expect(await page.evaluate(() => 'Zone' in window)).toBe(false);
  await expect(first.getByTestId('ready-count')).toHaveText('1');
  await paragraph(first).fill('Edited in the browser');
  await expect(first.getByTestId('change-count')).toHaveText('1');
  await expect(first.getByLabel('Last change')).toContainText(
    'Edited in the browser',
  );
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  expect((await saved(first)).blocks[0].data.text).toBe(
    'Edited in the browser',
  );
  await expect(first.getByTestId('change-count')).toHaveText('1');
  await expect(card(page, 'Second').getByTestId('change-count')).toHaveText(
    '0',
  );
});

test('supports focus, render, input replacement, read-only transitions and clear without feedback', async ({
  page,
}) => {
  const first = card(page, 'First');
  const focus = first.getByRole('button', { name: 'Focus', exact: true });
  await focus.focus();
  await page.keyboard.press('Enter');
  await expect(paragraph(first)).toBeFocused();
  await page.keyboard.insertText(' appended');
  await expect(first.getByTestId('change-count')).toHaveText('1');
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'render completed',
  );
  await expect(paragraph(first)).toHaveText('First rendered');
  await first.getByRole('button', { name: 'Replace input' }).click();
  await expect(paragraph(first)).toHaveText('First input replacement');
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(
    first.getByRole('button', { name: 'Read only' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(paragraph(first)).toHaveAttribute('contenteditable', 'false');
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'render completed',
  );
  await expect(paragraph(first)).toHaveText('First rendered');
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(paragraph(first)).toHaveAttribute('contenteditable', 'true');
  await first.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'clear completed',
  );
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  expect((await saved(first)).blocks).toEqual([]);
  await settleNotifications(page);
  await expect(first.getByTestId('change-count')).toHaveText('1');
  await expect(first.getByRole('alert')).toHaveCount(0);
});

test('presents an accessible error and recovers through the public controls', async ({
  page,
}) => {
  const first = card(page, 'First');
  const reject = first.getByRole('button', { name: 'Reject invalid document' });
  await reject.focus();
  await page.keyboard.press('Enter');
  await expect(first.getByRole('alert')).toHaveText('render: invalid-data');
  await expect(reject).toBeFocused();
  await expect(paragraph(first)).toHaveText('First initial');
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'render completed',
  );
  await expect(first.getByRole('alert')).toHaveCount(0);
  await first.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(paragraph(first)).toBeFocused();
});

test('disposes one owner while the other remains editable and remounts independently', async ({
  page,
}) => {
  const first = card(page, 'First');
  const second = card(page, 'Second');
  await first.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(page.getByTestId('active')).toHaveText('1');
  await expect(first.locator('.codex-editor')).toHaveCount(0);
  await paragraph(second).fill('Second survives');
  await expect(second.getByTestId('change-count')).toHaveText('1');
  await second.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(second.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  expect((await saved(second)).blocks[0].data.text).toBe('Second survives');
  await first.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect(first.getByRole('status')).toHaveText('Ready');
  await expect(first.getByTestId('ready-count')).toHaveText('2');
  await expect(paragraph(first)).toHaveText('First initial');
  await expect(paragraph(second)).toHaveText('Second survives');
  await expect(page.getByTestId('active')).toHaveText('2');
});

test('repeated teardown releases every created instance and suppresses detached DOM events', async ({
  page,
}) => {
  const first = card(page, 'First');
  const second = card(page, 'Second');
  for (let cycle = 0; cycle < 3; cycle++) {
    // Keep a test-owned handle so events can be dispatched on a detached node.
    // eslint-disable-next-line playwright/no-element-handle
    const detached = await paragraph(first).elementHandle();
    await paragraph(first).fill(`Pending change ${cycle}`);
    await first.getByRole('button', { name: 'Unmount', exact: true }).click();
    await second.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.getByTestId('active')).toHaveText('0');
    await expect(page.locator('.codex-editor')).toHaveCount(0);
    const outputs = await page.getByTestId('outputs').innerText();
    await detached!.evaluate((element) => {
      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'late' }),
      );
      element.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
      );
    });
    await detached!.dispose();
    await settleNotifications(page);
    await expect(page.getByTestId('outputs')).toHaveText(outputs);
    await expect(page.getByTestId('created')).toHaveText(
      String((cycle + 1) * 2),
    );
    await expect(page.getByTestId('destroyed')).toHaveText(
      String((cycle + 1) * 2),
    );
    if (cycle < 2) {
      await first.getByRole('button', { name: 'Mount', exact: true }).click();
      await second.getByRole('button', { name: 'Mount', exact: true }).click();
      await expect(first.getByRole('status')).toHaveText('Ready');
      await expect(second.getByRole('status')).toHaveText('Ready');
    }
  }
});

test('activates packed image and independent alt authoring in Angular', async ({
  page,
}) => {
  await page.goto('/?image');
  const first = card(page, 'First');
  const second = card(page, 'Second');
  await expect(first.getByRole('status')).toHaveText('Ready');
  const caption = first.locator('.image-tool__caption');
  await expect(caption).toHaveText('First initial');
  await first.getByLabel('Image purpose').selectOption('description');
  await first
    .getByLabel('Alternative text', { exact: true })
    .fill('Angular red square');
  await caption.fill('Angular caption');
  await caption.click();
  await first.locator('.ce-toolbar__settings-btn').click();
  await first.getByText('With border', { exact: true }).click();
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  await expect
    .poll(async () => (await saved(first)).blocks[0].data)
    .toMatchObject({
      alt: 'Angular red square',
      caption: 'Angular caption',
      withBorder: true,
    });
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(first.getByLabel('Image purpose')).toBeDisabled();
  await expect(caption).toHaveAttribute('contenteditable', 'false');
  await first.getByRole('button', { name: 'Read only' }).click();
  await expect(
    first.getByLabel('Alternative text', { exact: true }),
  ).toHaveValue('Angular red square');
  await first.getByRole('button', { name: 'Render', exact: true }).click();
  await expect(caption).toHaveText('First rendered');
  await expect(first.getByLabel('Image purpose')).toHaveValue('unset');
  await first.getByRole('button', { name: 'Clear', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await first.locator('.cdx-button').click();
  await (
    await chooser
  ).setFiles({
    name: 'red.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="red"/></svg>',
    ),
  });
  await expect(first.locator('img')).toBeVisible();
  await first.getByLabel('Image purpose').selectOption('decorative');
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first.getByTestId('command-result')).toHaveText(
    'save completed',
  );
  await expect
    .poll(async () => (await saved(first)).blocks[0].data)
    .toMatchObject({
      alt: '',
      file: { id: 'file', meta: { width: 80, owned: true } },
    });
  await first.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(first.locator('.codex-editor')).toHaveCount(0);
  await expect(second.getByLabel('Image purpose')).toHaveValue('unset');
});
