import { test, expect } from '../hydration/fixture.js';

test('packed paragraph stays lazy, constructs the selected class and round trips real edits', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname.slice(1)),
  );
  await page.goto('/paragraph.html');
  const graph: { chunks: string[] } = await (
    await page.request.get('/paragraph-graph.json')
  ).json();
  expect(graph.chunks.some((file) => requests.includes(file))).toBe(false);
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-paragraph-instances',
  );
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const holder = page.locator('#editor');
  const paragraph = holder.locator('.ce-paragraph');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute(
    'data-paragraph-instances',
    /[1-9]\d*/,
  );
  expect(graph.chunks.every((file) => requests.includes(file))).toBe(true);
  await expect(paragraph).toHaveAttribute(
    'data-placeholder-active',
    'Packaged paragraph',
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('style')].some((style) =>
          style.textContent?.includes('.ce-paragraph'),
        ),
      ),
    )
    .toBe(true);
  await paragraph.fill('Article text');
  await paragraph.press('ControlOrMeta+a');
  await paragraph.press('ControlOrMeta+b');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator('output').innerText()) || '{}').blocks,
    )
    .toMatchObject([
      { type: 'paragraph', data: { text: '<b>Article text</b>' } },
    ]);
  await paragraph.fill('Discard this edit');
  await page.getByRole('button', { name: 'Render saved' }).click();
  await expect(paragraph.locator('b')).toHaveText('Article text');
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(paragraph).toHaveAttribute('contenteditable', 'false');
  await expect(paragraph).toHaveText('Article text');
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(paragraph).toHaveAttribute('contenteditable', 'true');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(paragraph).toBeEmpty();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(
      async () => JSON.parse(await page.locator('output').innerText()).blocks,
    )
    .toMatchObject([{ type: 'paragraph', data: { text: '' } }]);
  await expect(page.locator('#builtin .ce-paragraph')).toBeVisible();
  await page.getByRole('button', { name: 'Save builtin' }).click();
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator('#builtin-output').innerText()) || '{}')
          .blocks,
    )
    .toEqual([]);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(holder).toBeEmpty();
});
