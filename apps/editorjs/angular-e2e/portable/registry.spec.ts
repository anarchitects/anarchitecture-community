import { test, expect } from '../hydration/fixture.js';
import { behavior, lifetime } from './assertions.js';
import type { Page } from '@playwright/test';

test('packed core README mounts, saves and disposes a real Editor.js instance', async ({
  page,
}) => {
  await page.goto('/readme.html');
  const holder = page.locator('#editor');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  await holder.locator('.ce-paragraph').fill('From the packed README');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(async () => {
      const text = await page.locator('output').textContent();
      return text ? JSON.parse(text).blocks : [];
    })
    .toMatchObject([
      { type: 'paragraph', data: { text: 'From the packed README' } },
    ]);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(holder).toHaveAttribute('data-removed', 'true');
  await expect(holder).toBeEmpty();
});

test('packed non-Angular host exercises the shared block, inline, tune and built-ins', async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname.slice(1)),
  );
  await page.goto('/');
  await behavior(page, 'portable');
  const graph: { tools: Record<string, string[]> } = await (
    await page.request.get('/registry-graph.json')
  ).json();
  for (const name of ['card', 'marker', 'flag'])
    expect(graph.tools[name].every((file) => requests.includes(file))).toBe(
      true,
    );
  expect(
    graph.tools['unselected'].some((file) => requests.includes(file)),
  ).toBe(false);
  await testInfo.attach('portable-delivery', {
    body: JSON.stringify({ graph, requests }),
    contentType: 'application/json',
  });
  expect(
    await page.evaluate(() => document.querySelector('aa-root')),
  ).toBeNull();
});
test('packed non-Angular host fences failed/pending loads and recreates independent editors', async ({
  page,
}) => {
  await page.goto('/');
  await lifetime(page);
  await expect(
    page.locator('[data-registry-owner="B"] .registry-card'),
  ).toBeVisible();
});

async function openCalloutSettings(page: Page) {
  const editable = page.getByRole('textbox', { name: 'Callout text' });
  await editable.click();
  await editable.hover();
  await page.locator('#editor .ce-toolbar__settings-btn').click();
}

async function openEditorialSettings(
  page: Page,
  index = 0,
  holder = '#editor',
) {
  const editable = page
    .locator(holder)
    .getByRole('textbox', { name: 'Editorial callout' })
    .nth(index);
  await editable.click();
  await editable.hover();
  await page.locator(`${holder} .ce-toolbar__settings-btn`).click();
}

test('archived marker supports keyboard application, active removal, bold and sanitized reload', async ({
  page,
}) => {
  await page.goto('/editorial.html');
  await expect(page.getByRole('status')).toHaveText('Ready');
  const text = page.getByRole('textbox', { name: 'Editorial callout' }).first();
  const marker = page.locator('[data-item-name="marker"]');
  await text.selectText();
  await text.dispatchEvent('mouseup', { bubbles: true });
  await expect(marker).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Highlight text', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(marker).toHaveClass(/focused/);
  await page.keyboard.press('Enter');
  await expect(text.locator('mark')).toHaveText('First callout');
  await expect(marker).toHaveClass(/active/);
  await marker.click();
  await expect(text.locator('mark')).toHaveCount(0);
  await expect(marker).not.toHaveClass(/active/);
  await page.locator('[data-item-name="bold"]').click();
  await expect(text.locator('b')).toHaveText('First callout');
  await marker.click();
  await expect(text.locator('mark b, b mark')).toHaveText('First callout');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = page.getByRole('textbox', { name: 'Saved document JSON' });
  await expect(saved).toHaveValue(/<mark>/);
  const doc = JSON.parse(await saved.inputValue());
  expect(doc.blocks[0].tunes.flag).toEqual({ flagged: false });
  doc.blocks[0].data.text =
    '<mark class="untrusted" onclick="alert(1)"><b>Restored</b></mark> plain';
  await saved.fill(JSON.stringify(doc));
  await page.getByRole('button', { name: 'Reload JSON' }).click();
  await expect(text.locator('mark')).toHaveText('Restored');
  expect(
    await text.locator('mark').evaluate((el) => el.attributes.length),
  ).toBe(0);
  await text.selectText();
  await text.dispatchEvent('mouseup', { bubbles: true });
  await expect(marker).toHaveClass(/disabled/);
  // The documented bounded removal supports a selection wholly inside one mark.
  await text.locator('mark').selectText();
  await text.dispatchEvent('mouseup', { bubbles: true });
  await expect(marker).not.toHaveClass(/disabled/);
  await expect(marker).toHaveClass(/active/);
  await marker.click();
  await expect(text.locator('mark')).toHaveCount(0);
  await expect(text.locator('b')).toHaveText('Restored');
  await page.getByRole('button', { name: 'Toggle read only' }).click();
  await expect(text).not.toBeEditable();
  await text.selectText();
  await text.dispatchEvent('mouseup', { bubbles: true });
  await expect(marker).toHaveCount(0);
});

test('archived flag tune uses the keyboard, keeps independent blocks and reloads saved state', async ({
  page,
}) => {
  await page.goto('/editorial.html');
  await expect(page.getByRole('status')).toHaveText('Ready');
  const flags = page.locator('#editor .callout-flag');
  await expect(flags.nth(0)).toHaveAttribute('data-flagged', 'false');
  await expect(flags.nth(1)).toHaveAttribute('data-flagged', 'false');
  await openEditorialSettings(page);
  const flagMenu = page.getByText('Flag for review', { exact: true });
  // Two block settings precede the custom tune in the upstream menu.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await expect(flagMenu.locator('..')).toHaveClass(/focused/);
  await page.keyboard.press('Enter');
  await expect(flags.nth(0)).toHaveAttribute('data-flagged', 'true');
  await expect(flags.nth(1)).toHaveAttribute('data-flagged', 'false');
  await expect(page.getByRole('status')).toHaveText('Changed');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = page.getByRole('textbox', { name: 'Saved document JSON' });
  await expect(saved).toHaveValue(/"flagged":true/);
  expect(
    JSON.parse(await saved.inputValue()).blocks.map(
      (b: { tunes: unknown }) => b.tunes,
    ),
  ).toEqual([{ flag: { flagged: true } }, { flag: { flagged: false } }]);
  await page.getByRole('button', { name: 'Reload JSON' }).click();
  await expect(page.getByRole('status')).toHaveText('Reloaded');
  await expect(flags.nth(0)).toHaveAttribute('data-flagged', 'true');
  await openEditorialSettings(page);
  await expect(flagMenu.locator('..')).toHaveClass(/active/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle read only' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Editorial callout' }).first(),
  ).not.toBeEditable();
  await expect(flags.nth(0)).toContainText('Flagged for review');
  await page.getByRole('button', { name: 'Remove editor' }).click();
  await expect(page.getByRole('status')).toHaveText('Removed');
  await expect(flags).toHaveCount(0);
});

for (const mode of ['editorial', 'editorial-alias']) {
  test(`archived inline/tune ${mode} guards and diagnostics preserve independent owners`, async ({
    page,
  }) => {
    await page.goto(`/custom-probe.html?mode=${mode}`);
    await expect(page.locator('#status')).toHaveText('Ready');
    const output = page.locator('output');
    const flagName = mode === 'editorial-alias' ? 'review' : 'flag';
    await openEditorialSettings(page);
    await page.getByText('Flag for review', { exact: true }).click();
    await page.getByRole('button', { name: 'Tune state', exact: true }).click();
    await expect(output).toContainText('"dispatches":1');
    await expect
      .poll(async () => {
        await page
          .getByRole('button', { name: 'Tune state', exact: true })
          .click();
        return JSON.parse(await output.innerText()).changes;
      })
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Save both' }).click();
    await expect(output).toContainText('"first"');
    const data = JSON.parse(await output.innerText());
    expect(data.first.blocks.map((b: { tunes: unknown }) => b.tunes)).toEqual([
      { [flagName]: { flagged: true } },
      { [flagName]: { flagged: false } },
    ]);
    expect(data.other.blocks.map((b: { tunes: unknown }) => b.tunes)).toEqual([
      { [flagName]: { flagged: false } },
      { [flagName]: { flagged: false } },
    ]);
    expect(data.first.blocks[0].type).toBe(
      mode === 'editorial-alias' ? 'aside' : 'callout',
    );
    const ownText = page.locator('#editor .callout-text').first();
    await ownText.selectText();
    await ownText.dispatchEvent('mouseup', { bubbles: true });
    await expect(
      page.locator(
        `#editor [data-item-name="${mode === 'editorial-alias' ? 'highlight' : 'marker'}"]`,
      ),
    ).toBeVisible();
    const otherText = page.locator('#other-editor .callout-text').first();
    await otherText.selectText();
    // Invoke a retained menu without a click that would clear the foreign selection.
    await page
      .getByRole('button', { name: 'Marker guards' })
      .dispatchEvent('click');
    await expect(output).toContainText('"unchanged":true');
    const guard = JSON.parse(await output.innerText());
    expect(guard.checked).toBeGreaterThan(0);
    expect(guard.disabled).toBe(true);
    await expect(otherText.locator('mark')).toHaveCount(0);
    await page.locator('#editor').evaluate((holder) => {
      const fields = holder.querySelectorAll('.callout-text');
      const range = document.createRange();
      range.setStart(fields[0].firstChild!, 0);
      range.setEnd(fields[1].firstChild!, 3);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await page
      .getByRole('button', { name: 'Marker guards' })
      .dispatchEvent('click');
    await expect(output).toContainText('"disabled":true');
    await expect(output).toContainText('"unchanged":true');
    await page.getByRole('button', { name: 'Disable probe' }).click();
    await expect(ownText).not.toBeEditable();
    await page.getByRole('button', { name: 'Stale tune' }).click();
    await expect(output).toContainText('"dispatches":1');
    await expect(output).toContainText('"disabled":true');
    await ownText.selectText();
    await page
      .getByRole('button', { name: 'Marker guards' })
      .dispatchEvent('click');
    await expect(output).toContainText('"disabled":true');
    await expect(output).toContainText('"unchanged":true');
    await page.getByRole('button', { name: 'Reference diagnostics' }).click();
    await expect(output).toContainText('duplicate-name');
    const diagnostics = JSON.parse(await output.innerText());
    expect(diagnostics.missing).toContain('invalid-reference');
    expect(diagnostics.wrongKind).toContain('invalid-reference');
    await page
      .getByRole('button', { name: 'Invalid tune before load' })
      .click();
    await expect(output).toContainText('"loads":0');
    await expect(output).toContainText('tool_data_invalid');
    await page
      .getByRole('button', { name: 'Remove probe', exact: true })
      .click();
    await expect(page.locator('#editor')).toBeEmpty();
    await otherText.selectText();
    await page
      .getByRole('button', { name: 'Marker guards' })
      .dispatchEvent('click');
    await expect(output).toContainText('"unchanged":true');
    await expect(output).toContainText('"disabled":true');
    await page.getByRole('button', { name: 'Stale tune' }).click();
    await expect(output).toContainText('"dispatches":1');
    await openEditorialSettings(page, 1, '#other-editor');
    await page.getByText('Flag for review', { exact: true }).click();
    await expect(
      page.locator('#other-editor .callout-flag').nth(1),
    ).toHaveAttribute('data-flagged', 'true');
  });
}

test('archived custom-block page edits with keyboard, saves, reloads, disables and removes', async ({
  page,
}) => {
  await page.goto('/custom-tool.html');
  await expect(page.getByRole('status')).toHaveText('Ready');
  const text = page.getByRole('textbox', { name: 'Callout text' });
  await text.focus();
  await expect(text).toBeFocused();
  await text.press('ControlOrMeta+A');
  await text.pressSequentially('Keyboard callout');
  await expect(page.getByRole('status')).toHaveText('Changed');
  await openCalloutSettings(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-item-name="callout-warning"]')).toHaveClass(
    /focused/,
  );
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = page.getByRole('textbox', { name: 'Saved document JSON' });
  await expect(saved).toHaveValue(/Keyboard callout/);
  const document = JSON.parse(await saved.inputValue());
  expect(document.blocks).toMatchObject([
    { type: 'callout', data: { text: 'Keyboard callout', tone: 'warning' } },
  ]);
  await text.fill('Temporary edit');
  await page.getByRole('button', { name: 'Reload JSON' }).click();
  await expect(text).toHaveText('Keyboard callout');
  await openCalloutSettings(page);
  await expect(page.locator('[data-item-name="callout-warning"]')).toHaveClass(
    /active/,
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle read only' }).click();
  await expect(text).not.toBeEditable();
  await expect(text).toHaveAttribute('aria-readonly', 'true');
  await page.getByRole('button', { name: 'Toggle read only' }).click();
  await expect(text).toBeEditable();
  await text.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(async () => JSON.parse(await saved.inputValue()).blocks[0]?.data.text)
    .toBe('');
  expect(JSON.parse(await saved.inputValue()).blocks).toHaveLength(1);
  await page.getByRole('button', { name: 'Remove editor' }).click();
  await expect(page.getByRole('status')).toHaveText('Removed');
  await expect(page.locator('#editor')).toBeEmpty();
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toBeDisabled();
  // The removal handler was aborted too; repeated clicks cannot recreate work.
  await page.getByRole('button', { name: 'Remove editor' }).click();
  await expect(page.getByRole('status')).toHaveText('Removed');
});

test('archived custom block rejects invalid documents and sanitizes allowed HTML before insertion', async ({
  page,
}) => {
  await page.goto('/custom-tool.html');
  await expect(page.getByRole('status')).toHaveText('Ready');
  const saved = page.getByRole('textbox', { name: 'Saved document JSON' });
  const text = page.getByRole('textbox', { name: 'Callout text' });
  for (const input of [
    '{',
    JSON.stringify({ blocks: [{ type: 'callout', data: { text: '' } }] }),
    JSON.stringify({ blocks: [{ type: 'unknown', data: {} }] }),
  ]) {
    await saved.fill(input);
    await page.getByRole('button', { name: 'Reload JSON' }).click();
    await expect(page.getByRole('status')).toContainText('Error:');
    await expect(text).toHaveText('Hello editor');
  }
  await saved.fill(
    JSON.stringify({
      blocks: [
        {
          type: 'callout',
          data: {
            text: '<img src="/must-not-load" onerror="document.body.dataset.executed=1"><b onclick="document.body.dataset.executed=1">Bold</b><mark style="color:red">Marked</mark><a href="javascript:alert(1)">Link</a>',
            tone: 'info',
          },
        },
      ],
    }),
  );
  const unsafeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/must-not-load'))
      unsafeRequests.push(request.url());
  });
  await page.getByRole('button', { name: 'Reload JSON' }).click();
  await expect(text.locator('b')).toHaveText('Bold');
  await expect(text.locator('mark')).toHaveText('Marked');
  expect(await text.innerHTML()).toBe('<b>Bold</b><mark>Marked</mark>Link');
  await text.locator('b').click();
  expect(await page.locator('body').getAttribute('data-executed')).toBeNull();
  expect(unsafeRequests).toEqual([]);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(async () => JSON.parse(await saved.inputValue()).blocks[0].data.text)
    .toBe('<b>Bold</b><mark>Marked</mark>Link');
});

for (const mode of ['direct', 'eager', 'alias']) {
  test(`archived custom block works with ${mode} registration and configured output identity`, async ({
    page,
  }) => {
    await page.goto(`/custom-probe.html?mode=${mode}`);
    await expect(page.locator('#status')).toHaveText('Ready');
    await page
      .getByRole('textbox', { name: 'Callout text' })
      .fill('Configured');
    await page.getByRole('button', { name: 'Save probe' }).click();
    await expect(page.locator('output')).toContainText('Configured');
    expect(
      JSON.parse(await page.locator('output').innerText()).blocks,
    ).toMatchObject([
      {
        type: mode === 'alias' ? 'aside' : 'callout',
        data: { text: 'Configured', tone: 'info' },
      },
    ]);
    await page.getByRole('button', { name: 'Invalid before load' }).click();
    await expect(page.locator('output')).toContainText('tone');
    expect(JSON.parse(await page.locator('output').innerText()).loads).toBe(0);
    await page.getByRole('button', { name: 'Remove probe' }).click();
    await expect(page.locator('#editor')).toBeEmpty();
  });
}

test('custom tone dispatches a change without DOM mutation and stale callbacks stop on destruction', async ({
  page,
}) => {
  await page.goto('/custom-probe.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.getByRole('button', { name: 'Pending owner' }).click();
  await expect(page.locator('output')).toContainText('constructed');
  expect(JSON.parse(await page.locator('output').innerText())).toMatchObject({
    constructed: 0,
    children: 0,
  });
  expect(JSON.parse(await page.locator('output').innerText()).error).toMatch(
    /disposed|removed/i,
  );
  await openCalloutSettings(page);
  const before = Number(
    (await page.locator('#editor').getAttribute('data-changes')) ?? 0,
  );
  await page.getByText('Warning tone', { exact: true }).click();
  await expect
    .poll(async () =>
      Number((await page.locator('#editor').getAttribute('data-changes')) ?? 0),
    )
    .toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Save probe' }).click();
  await expect(page.locator('output')).toContainText('warning');
  await page.getByRole('button', { name: 'Disable probe' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Callout text' }),
  ).not.toBeEditable();
  await page.getByRole('button', { name: 'Remove probe' }).click();
  await expect(page.locator('#editor')).toBeEmpty();
  await page.getByRole('button', { name: 'Probe state' }).click();
  await expect(page.locator('output')).toContainText('editable');
  const state = JSON.parse(await page.locator('output').innerText());
  expect(state.destroys).toBeGreaterThan(0);
  expect(state.editable).toBe('false');
  await page.getByRole('button', { name: 'Stale settings' }).click();
  await expect(page.locator('output')).toHaveText(JSON.stringify(state));
});

test('custom toolbox seeds warning data without replacing restored information tone', async ({
  page,
}) => {
  await page.goto('/custom-tool.html');
  await expect(page.getByRole('status')).toHaveText('Ready');
  const text = page.getByRole('textbox', { name: 'Callout text' });
  await text.click();
  await text.hover();
  await page.locator('#editor .ce-toolbar__plus').click();
  await page.getByText('Warning callout', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Callout text' })).toHaveCount(
    2,
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = page.getByRole('textbox', { name: 'Saved document JSON' });
  await expect(saved).toHaveValue(/warning/);
  expect(JSON.parse(await saved.inputValue()).blocks).toMatchObject([
    { data: { text: 'Hello <b>editor</b>', tone: 'info' } },
    { data: { text: '', tone: 'warning' } },
  ]);
});

test('upstream validate-false omits content rather than rejecting save', async ({
  page,
}) => {
  await page.goto('/custom-probe.html?mode=omission');
  await expect(page.locator('#status')).toHaveText('Ready');
  await expect(page.getByRole('textbox', { name: 'Callout text' })).toHaveText(
    'Original',
  );
  await page.getByRole('button', { name: 'Save probe' }).click();
  await expect(page.locator('output')).toContainText('blocks');
  expect(JSON.parse(await page.locator('output').innerText()).blocks).toEqual(
    [],
  );
});
