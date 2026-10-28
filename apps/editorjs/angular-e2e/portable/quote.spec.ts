import { test, expect } from '../hydration/fixture.js';

test('packed quote edits text/caption, saves alignment and isolates read-only owners', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname.slice(1)),
  );
  await page.goto('/quote.html');
  const graph: { chunks: string[] } = await (
    await page.request.get('/quote-graph.json')
  ).json();
  expect(graph.chunks.some((file) => requests.includes(file))).toBe(false);
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-quote-instances',
  );
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const holder = page.locator('#editor');
  const text = holder.locator('.cdx-quote__text');
  const caption = holder.locator('.cdx-quote__caption');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  expect(graph.chunks.every((file) => requests.includes(file))).toBe(true);
  await expect(page.locator('html')).toHaveAttribute(
    'data-quote-instances',
    /[3-9]\d*|[1-9]\d+/,
  );
  await expect(text).toHaveAttribute('data-placeholder', 'Quotation');
  await expect(caption).toHaveAttribute('data-placeholder', 'Attribution');
  const save = async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(holder).toHaveAttribute('data-command', 'save');
    return JSON.parse(await page.locator('output').innerText()).blocks[0].data;
  };
  expect(await save()).toEqual({ text: '', caption: '', alignment: 'center' });
  await text.fill('A portable quotation');
  await caption.fill('An author');
  await text.click();
  await holder.locator('.ce-toolbar__plus').click();
  await expect(
    holder
      .locator('.ce-toolbox .ce-popover-item__title')
      .filter({ hasText: /^Citation$/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  const settings = async () => {
    await text.click();
    await holder.locator('.ce-toolbar__settings-btn').click();
  };
  await settings();
  await holder.getByText('Align Left', { exact: true }).click();
  expect(await save()).toEqual({
    text: 'A portable quotation',
    caption: 'An author',
    alignment: 'left',
  });
  const appearance = await text.evaluate(
    (element) => getComputedStyle(element).textAlign,
  );
  await settings();
  await holder.getByText('Align Center', { exact: true }).click();
  expect(await save()).toEqual({
    text: 'A portable quotation',
    caption: 'An author',
    alignment: 'center',
  });
  // Upstream's setting changes saved semantics, not editing CSS.
  await expect(text).toHaveCSS('text-align', appearance);
  await text.fill('Discard text');
  await caption.fill('Discard caption');
  await page.getByRole('button', { name: 'Render saved' }).click();
  await expect(text).toHaveText('A portable quotation');
  await expect(caption).toHaveText('An author');
  await expect(text).toHaveCSS('text-align', appearance);
  await settings();
  await expect(
    holder
      .locator('.ce-popover-item--active')
      .filter({ hasText: 'Align Center' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(text).toHaveAttribute('contenteditable', 'false');
  await expect(caption).toHaveAttribute('contenteditable', 'false');
  await expect(holder.locator('.ce-toolbar__settings-btn')).toBeHidden();
  await text.click();
  await page.keyboard.type('ignored');
  await expect(text).toHaveText('A portable quotation');
  await caption.click();
  await page.keyboard.type('ignored');
  await expect(caption).toHaveText('An author');
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(text).toHaveAttribute('contenteditable', 'true');
  await expect(caption).toHaveAttribute('contenteditable', 'true');
  const second = page.locator('#second');
  await expect(second.locator('.cdx-quote__text')).toHaveAttribute(
    'data-placeholder',
    '',
  );
  await expect(second.locator('.cdx-quote__caption')).toHaveAttribute(
    'data-placeholder',
    '',
  );
  await second.locator('.cdx-quote__text').fill('Independent');
  await second.locator('.cdx-quote__caption').fill('Another author');
  await page.getByRole('button', { name: 'Save second' }).click();
  await expect(holder).toHaveAttribute('data-command', 'save-second');
  expect(
    JSON.parse(await page.locator('#second-output').innerText()).blocks[0],
  ).toMatchObject({
    type: 'citation',
    data: { text: 'Independent', caption: 'Another author', alignment: 'left' },
  });
  await expect(page.locator('#defaults .cdx-quote__text')).toHaveAttribute(
    'data-placeholder',
    'Enter a quote',
  );
  await expect(page.locator('#defaults .cdx-quote__caption')).toHaveAttribute(
    'data-placeholder',
    'Enter a caption',
  );
  await page.getByRole('button', { name: 'Save defaults' }).click();
  await expect(holder).toHaveAttribute('data-command', 'save-defaults');
  expect(
    JSON.parse(await page.locator('#defaults-output').innerText()).blocks[0]
      .data,
  ).toEqual({ text: '', caption: '', alignment: 'left' });
  await page.getByRole('button', { name: 'Remove main' }).click();
  await expect(holder).toBeEmpty();
  await second.locator('.cdx-quote__caption').fill('Still independent');
  await page.getByRole('button', { name: 'Save second' }).click();
  await expect(page.locator('#second-output')).toContainText(
    'Still independent',
  );
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(second).toBeEmpty();
  await expect(page.locator('#defaults')).toBeEmpty();
});
