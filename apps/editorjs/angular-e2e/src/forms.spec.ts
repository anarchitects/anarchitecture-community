import { expect, test, type Locator, type Page } from '@playwright/test';

const card = (page: Page, name = 'First') =>
  page.getByRole('region', { name: `${name} form`, exact: true });
const paragraphs = (owner: Locator) => owner.locator('.ce-paragraph');
const button = (owner: Locator, name: string) =>
  owner.getByRole('button', { name, exact: true });
const model = (owner: Locator) =>
  owner.getByLabel('Model document', { exact: true });
async function settleNotifications(page: Page): Promise<void> {
  // Editor.js batches mutations for 400ms; observe late output beyond that window.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(750);
}
// Retain a test-owned handle specifically to dispatch events after disposal.
async function retainParagraph(owner: Locator) {
  const element = await paragraphs(owner).elementHandle();
  if (!element) throw new Error('Expected an attached paragraph');
  return element;
}
async function holdEdit(owner: Locator, text: string): Promise<void> {
  await button(owner, 'Hold next save').click();
  await expect(owner.getByTestId('armed')).toHaveText('true');
  await paragraphs(owner).first().fill(text);
  await expect(owner.getByTestId('held')).toHaveText('true');
  await expect(owner.getByLabel('Held document')).toContainText(text);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.goto('/?forms');
  for (const name of ['First', 'Second', 'Legacy']) {
    await expect(card(page, name).getByRole('status')).toHaveText('Ready');
  }
});

test('binds real keyboard edits, composite touch and detached events in independent Signal Forms controls', async ({
  page,
}) => {
  const first = card(page);
  const second = card(page, 'Second');
  expect(await page.evaluate(() => 'Zone' in window)).toBe(false);
  await expect(paragraphs(first)).toHaveText('First initial');
  await expect(model(first)).toContainText('First initial');
  await expect(first.getByTestId('dirty')).toHaveText('false');
  await expect(first.getByTestId('touched')).toHaveText('false');
  await button(first, 'Focus').focus();
  await page.keyboard.press('Enter');
  await expect(paragraphs(first)).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Keyboard paragraph');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Another block');
  await expect(paragraphs(first)).toHaveCount(2);
  await expect(model(first)).toContainText('Keyboard paragraph');
  await expect(model(first)).toContainText('Another block');
  await expect(first.getByTestId('dirty')).toHaveText('true');
  await paragraphs(first).first().click();
  await expect(first.getByTestId('touched')).toHaveText('false');
  await expect(first.getByTestId('touches')).toHaveText('0');
  await button(first, 'Mutate event').click();
  await expect(first.getByLabel('Change document')).toContainText(
    'Mutated event',
  );
  await expect(model(first)).toContainText('Keyboard paragraph');
  await expect(model(first)).not.toContainText('Mutated event');
  await expect(first.getByTestId('touched')).toHaveText('true');
  await expect(second.getByTestId('dirty')).toHaveText('false');
  await expect(second.getByTestId('touched')).toHaveText('false');
  await expect(second.getByTestId('changes')).toHaveText('0');
  await expect(paragraphs(second)).toHaveText('Second initial');
});

test('projects external writes and resets both the document and native flags without feedback', async ({
  page,
}) => {
  const first = card(page);
  await button(first, 'Replace value').click();
  await expect(paragraphs(first)).toHaveText('First replacement');
  await expect(model(first)).toContainText('First replacement');
  await expect(first.getByTestId('dirty')).toHaveText('false');
  await expect(first.getByTestId('touched')).toHaveText('false');
  await expect(first.getByTestId('changes')).toHaveText('0');
  await paragraphs(first).fill('User value');
  await expect(model(first)).toContainText('User value');
  await button(first, 'Capture').click();
  await expect(first.getByTestId('result')).toHaveText('Captured');
  await expect(first.getByTestId('dirty')).toHaveText('true');
  await expect(first.getByTestId('touched')).toHaveText('true');
  const changes = await first.getByTestId('changes').innerText();
  await button(first, 'Reset').click();
  await expect(paragraphs(first)).toHaveText('First reset');
  await expect(model(first)).toContainText('First reset');
  await expect(first.getByTestId('dirty')).toHaveText('false');
  await expect(first.getByTestId('touched')).toHaveText('false');
  await settleNotifications(page);
  await expect(first.getByTestId('changes')).toHaveText(changes);
});

test('applies disabled/readonly modes, focus and resets through native schema state', async ({
  page,
}) => {
  const first = card(page);
  const control = first.getByRole('group', {
    name: 'First document',
    exact: true,
  });
  await button(first, 'Disabled').click();
  await expect(control).toHaveAttribute('aria-disabled', 'true');
  await expect(control.locator(':scope > div')).toHaveAttribute('inert', '');
  await expect(paragraphs(first)).toHaveAttribute('contenteditable', 'false');
  await button(first, 'Focus').click();
  await expect(button(first, 'Focus')).toBeFocused();
  await button(first, 'Reset').click();
  await expect(paragraphs(first)).toHaveText('First reset');
  await button(first, 'Disabled').click();
  await expect(paragraphs(first)).toHaveAttribute('contenteditable', 'true');
  await button(first, 'Read only').click();
  await expect(paragraphs(first)).toHaveAttribute('contenteditable', 'false');
  await expect(control).toHaveAttribute('data-readonly', 'true');
  await button(first, 'Focus').click();
  await expect(control).toBeFocused();
  await button(first, 'Replace value').click();
  await expect(paragraphs(first)).toHaveText('First replacement');
  await button(first, 'Read only').click();
  await expect(paragraphs(first)).toHaveAttribute('contenteditable', 'true');
  await button(first, 'Focus').click();
  await expect(paragraphs(first)).toBeFocused();
  await expect(model(first)).toContainText('First replacement');
  await expect(first.getByTestId('dirty')).toHaveText('false');
  await expect(first.getByTestId('changes')).toHaveText('0');
});

test('an unchanged-value reset fences an actual in-flight saved edit', async ({
  page,
}) => {
  const first = card(page);
  await holdEdit(first, 'Obsolete saved edit');
  await expect(model(first)).toContainText('First initial');
  await button(first, 'Reset same value').click();
  await expect(first.getByTestId('dirty')).toHaveText('false');
  await expect(first.getByTestId('touched')).toHaveText('false');
  await button(first, 'Release save').click();
  await expect(first.getByTestId('held')).toHaveText('false');
  await expect(paragraphs(first)).toHaveText('First initial');
  await settleNotifications(page);
  await expect(first.getByTestId('changes')).toHaveText('0');
  await expect(model(first)).toContainText('First initial');
  await expect(first.getByTestId('dirty')).toHaveText('false');
  await expect(first.getByTestId('touched')).toHaveText('false');
  await button(first, 'Capture').click();
  await expect(first.getByLabel('Captured document')).toContainText(
    'First initial',
  );
});

test('repeated teardown suppresses held saves and detached DOM events while another control survives', async ({
  page,
}) => {
  const first = card(page);
  const second = card(page, 'Second');
  for (let cycle = 0; cycle < 3; cycle++) {
    await holdEdit(first, `Disposed edit ${cycle}`);
    const detached = await retainParagraph(first);
    await button(first, 'Unmount').click();
    await expect(first.locator('.codex-editor')).toHaveCount(0);
    await expect(page.getByTestId('active')).toHaveText('2');
    const outputs = await page.getByTestId('outputs').innerText();
    const touched = await first.getByTestId('touched').innerText();
    await detached.evaluate((element) => {
      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'late' }),
      );
      element.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
      );
      element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await detached.dispose();
    await button(first, 'Release save').click();
    await expect(first.getByTestId('held')).toHaveText('false');
    await settleNotifications(page);
    await expect(page.getByTestId('outputs')).toHaveText(outputs);
    await expect(first.getByTestId('changes')).toHaveText('0');
    await expect(first.getByTestId('dirty')).toHaveText('false');
    await expect(first.getByTestId('touched')).toHaveText(touched);
    await expect(model(first)).toContainText('First initial');
    await button(first, 'Mount').click();
    await expect(first.getByRole('status')).toHaveText('Ready');
    await expect(first.getByTestId('ready-count')).toHaveText(
      String(cycle + 2),
    );
    await expect(paragraphs(first)).toHaveText('First initial');
  }
  await paragraphs(second).fill('Independent survivor');
  await expect(model(second)).toContainText('Independent survivor');
  await expect(second.getByTestId('dirty')).toHaveText('true');
  for (const name of ['First', 'Second', 'Legacy'])
    await button(card(page, name), 'Unmount').click();
  await expect(page.locator('.codex-editor')).toHaveCount(0);
  await expect(page.getByTestId('created')).toHaveText('6');
  await expect(page.getByTestId('destroyed')).toHaveText('6');
  await expect(page.getByTestId('active')).toHaveText('0');
});

test('exposes validation, async pending and failed submission without losing the edited document', async ({
  page,
}) => {
  const first = card(page);
  await button(first, 'Empty document').click();
  await expect(first.getByTestId('invalid')).toHaveText('true');
  await expect(first.getByTestId('validation-errors')).toContainText(
    'Write a paragraph.',
  );
  await expect(first.getByRole('alert')).toHaveCount(0);
  await paragraphs(first).fill('Validated document');
  await expect(model(first)).toContainText('Validated document');
  await expect(first.getByTestId('invalid')).toHaveText('false');
  await button(first, 'Start validation').click();
  await expect(first.getByTestId('pending')).toHaveText('true');
  await button(first, 'Submit').click();
  await expect(first.getByTestId('result')).toHaveText('Submit requested');
  await expect(first.getByTestId('submitting')).toHaveText('false');
  await expect(button(first, 'Fail submission')).toBeDisabled();
  await button(first, 'Reject validation').click();
  await expect(first.getByTestId('pending')).toHaveText('false');
  await expect(first.getByTestId('invalid')).toHaveText('true');
  await expect(first.getByTestId('validation-errors')).toContainText(
    'Document needs review.',
  );
  await button(first, 'Start validation').click();
  await expect(first.getByTestId('pending')).toHaveText('true');
  await button(first, 'Accept validation').click();
  await expect(first.getByTestId('invalid')).toHaveText('false');
  await button(first, 'Submit').click();
  await expect(first.getByTestId('submitting')).toHaveText('true');
  await expect(button(first, 'Submit')).toBeDisabled();
  await expect(first.getByLabel('Captured document')).toContainText(
    'Validated document',
  );
  await button(first, 'Fail submission').click();
  await expect(first.getByTestId('submitting')).toHaveText('false');
  await expect(first.getByTestId('result')).toHaveText('Submission rejected');
  await expect(first.getByTestId('validation-errors')).toContainText(
    'Save failed. Try again.',
  );
  await expect(model(first)).toContainText('Validated document');
  await expect(paragraphs(first)).toHaveText('Validated document');
  await expect(first.getByTestId('dirty')).toHaveText('true');
  await expect(first.getByTestId('touched')).toHaveText('true');
  await expect(first.getByRole('alert')).toHaveCount(0);
});

test('shows operational failures independently of validation and recovers from invalid input', async ({
  page,
}) => {
  const first = card(page);
  await button(first, 'Fail next save').click();
  await button(first, 'Capture').click();
  await expect(first.getByTestId('result')).toHaveText('Capture rejected');
  await expect(first.getByRole('alert')).toHaveText('save: operation-failed');
  await expect(first.getByTestId('invalid')).toHaveText('false');
  await expect(model(first)).toContainText('First initial');
  await button(first, 'Invalid document').click();
  await expect(first.getByRole('alert')).toHaveText('data: invalid-data');
  await expect(paragraphs(first)).toHaveText('First initial');
  await expect(model(first)).toContainText('"type": ""');
  await button(first, 'Reset').click();
  await expect(paragraphs(first)).toHaveText('First reset');
  await expect(first.getByRole('alert')).toHaveCount(0);
  await button(first, 'Capture').click();
  await expect(first.getByTestId('result')).toHaveText('Captured');
  await expect(first.getByLabel('Captured document')).toContainText(
    'First reset',
  );
  await expect(first.getByTestId('errors')).toHaveText('2');
});

test('uses native reactive Forms binding with explicit reset fencing and disabled projection', async ({
  page,
}) => {
  const legacy = card(page, 'Legacy');
  await expect(model(legacy)).toContainText('Legacy initial');
  await paragraphs(legacy).fill('Legacy edited');
  await expect(model(legacy)).toContainText('Legacy edited');
  await button(legacy, 'Capture').click();
  await expect(legacy.getByTestId('result')).toHaveText('Captured');
  await expect(legacy.getByTestId('dirty')).toHaveText('true');
  await expect(legacy.getByTestId('touched')).toHaveText('true');
  await holdEdit(legacy, 'Obsolete legacy edit');
  await button(legacy, 'Reset').click();
  await button(legacy, 'Release save').click();
  await expect(paragraphs(legacy)).toHaveText('Legacy reset');
  await expect(model(legacy)).toContainText('Legacy reset');
  await expect(legacy.getByTestId('dirty')).toHaveText('false');
  await expect(legacy.getByTestId('touched')).toHaveText('false');
  await button(legacy, 'Disabled').click();
  await expect(paragraphs(legacy)).toHaveAttribute('contenteditable', 'false');
  await button(legacy, 'Disabled').click();
  await expect(paragraphs(legacy)).toHaveAttribute('contenteditable', 'true');
  await expect(legacy.getByTestId('errors')).toHaveText('0');
});
