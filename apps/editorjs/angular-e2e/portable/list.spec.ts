import assert from 'node:assert/strict';
import { test, expect } from '../hydration/fixture.js';

test('packed list edits nested items and modes with isolated owners and read-only checklists', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname.slice(1)),
  );
  await page.goto('/list.html');
  const graph: { chunks: string[] } = await (
    await page.request.get('/list-graph.json')
  ).json();
  expect(graph.chunks.some((file) => requests.includes(file))).toBe(false);
  await expect(page.locator('html')).not.toHaveAttribute('data-list-instances');
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const holder = page.locator('#editor');
  const content = holder.locator('.cdx-list__item-content');
  const children = holder.locator('.cdx-list__item-children');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  expect(graph.chunks.every((file) => requests.includes(file))).toBe(true);
  await expect(page.locator('html')).toHaveAttribute(
    'data-list-instances',
    /[3-9]\d*/,
  );
  await expect(holder.locator('.cdx-list-unordered')).toBeVisible();
  await content.fill('Parent');
  await content.press('End');
  await content.press('Enter');
  await content.nth(1).fill('Child');
  await content.nth(1).press('Tab');
  await expect(children.locator('.cdx-list__item-content')).toHaveText('Child');
  await content.nth(1).press('Enter');
  await content.nth(2).fill('Sibling');
  await content.nth(2).press('Tab');
  // maxLevel: 2 prevents a third level, even when a preceding sibling exists.
  await expect(children.locator('.cdx-list__item-children')).toHaveCount(0);
  await content.nth(2).press('Shift+Tab');
  await expect(
    holder.locator('.cdx-list > .cdx-list__item > .cdx-list__item-content'),
  ).toHaveText(['Parent', 'Sibling']);
  const save = async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(holder).toHaveAttribute('data-command', 'save');
    await expect(page.locator('output')).toContainText('"blocks"');
    return JSON.parse(await page.locator('output').innerText()).blocks[0].data;
  };
  let saved = await save();
  expect(saved).toMatchObject({
    style: 'unordered',
    meta: {},
    items: [
      { content: 'Parent', items: [{ content: 'Child' }] },
      { content: 'Sibling' },
    ],
  });
  const mode = async (name: string) => {
    await content.first().click();
    await holder.locator('.ce-toolbar__settings-btn').click();
    await holder
      .locator('.ce-settings .ce-popover-item__title')
      .filter({ hasText: new RegExp(`^${name}$`) })
      .click();
  };
  await mode('Ordered');
  await expect(holder.locator('ol.cdx-list')).toBeVisible();
  expect((await save()).style).toBe('ordered');
  await content.first().click();
  await holder.locator('.ce-toolbar__settings-btn').click();
  await holder.getByText('Counter type', { exact: true }).click();
  const counters = holder.locator(
    '.ce-popover--nested .ce-popover-item__title',
  );
  await expect(counters).toHaveText(['Numeric', 'Upper Roman']);
  await counters.filter({ hasText: 'Upper Roman' }).click();
  await content.first().click();
  await holder.locator('.ce-toolbar__settings-btn').click();
  await holder.getByText('Start with', { exact: true }).click();
  const start = holder.locator('.ce-popover--nested input');
  await start.fill('3');
  await start.press('Enter');
  await page
    .getByRole('heading', { name: 'Packaged list', exact: true })
    .click();
  saved = await save();
  expect(saved).toMatchObject({
    style: 'ordered',
    meta: { start: 3, counterType: 'upper-roman' },
  });
  await content.first().fill('Discard');
  await page.getByRole('button', { name: 'Render saved' }).click();
  await expect(content.first()).toHaveText('Parent');
  await expect(holder.locator('ol.cdx-list')).toHaveCSS(
    'counter-reset',
    'item 2',
  );
  await mode('Checklist');
  const checkbox = holder.locator('.cdx-list__checkbox').first();
  await checkbox.click();
  saved = await save();
  expect(saved).toMatchObject({
    style: 'checklist',
    meta: {},
    items: [
      {
        content: 'Parent',
        meta: { checked: true },
        items: [{ content: 'Child', meta: { checked: false } }],
      },
      { content: 'Sibling', meta: { checked: false }, items: [] },
    ],
  });
  await checkbox.click();
  await page.getByRole('button', { name: 'Render saved' }).click();
  await expect(checkbox).toHaveClass(/--checked/);
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(content.first()).toHaveAttribute('contenteditable', 'false');
  const box = await checkbox.boundingBox();
  assert(box, 'Missing readonly checkbox');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(checkbox).toHaveClass(/--checked/);
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(content.first()).toHaveAttribute('contenteditable', 'true');
  await checkbox.click();
  await expect(checkbox).not.toHaveClass(/--checked/);
  await save();
  await mode('Unordered');
  await expect(holder.locator('ul.cdx-list.cdx-list-unordered')).toBeVisible();
  expect((await save()).style).toBe('unordered');
  const flat = page.locator('#flat .cdx-list__item-content');
  await flat.fill('Flat first');
  await flat.press('End');
  await flat.press('Enter');
  await flat.nth(1).fill('Flat second');
  await flat.nth(1).press('Tab');
  await expect(page.locator('#flat .cdx-list__item-children')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save flat' }).click();
  await expect(page.locator('#flat-output')).toContainText('Flat second');
  await expect(page.locator('#defaults .cdx-list-unordered')).toBeVisible();
  await page.getByRole('button', { name: 'Remove main' }).click();
  await expect(holder).toBeEmpty();
  await flat.nth(1).fill('Independent after removal');
  await page.getByRole('button', { name: 'Save flat' }).click();
  await expect(page.locator('#flat-output')).toContainText(
    'Independent after removal',
  );
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('#flat')).toBeEmpty();
  await expect(page.locator('#defaults')).toBeEmpty();
});
