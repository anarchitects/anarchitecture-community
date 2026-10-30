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
