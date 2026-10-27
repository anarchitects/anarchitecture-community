import { test, expect } from '../hydration/fixture.js';

test('packed header stays lazy and edits, selects levels and round trips saved headings', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname.slice(1)),
  );
  await page.goto('/header.html');
  const graph: { chunks: string[] } = await (
    await page.request.get('/header-graph.json')
  ).json();
  expect(graph.chunks.some((file) => requests.includes(file))).toBe(false);
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-header-instances',
  );
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const holder = page.locator('#editor');
  const heading = holder.locator('.ce-header');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute(
    'data-header-instances',
    /[1-9]\d*/,
  );
  expect(graph.chunks.every((file) => requests.includes(file))).toBe(true);
  await expect(holder.locator('h2.ce-header')).toBeVisible();
  await expect(heading).toHaveAttribute('data-placeholder', 'Section title');
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('style')].some((style) =>
          style.textContent?.includes('.ce-header'),
        ),
      ),
    )
    .toBe(true);
  await heading.fill('Article heading');
  await heading.press('ControlOrMeta+a');
  await heading.press('ControlOrMeta+i');
  await expect(heading.locator('i')).toHaveText('Article heading');
  await heading.click();
  await holder.locator('.ce-toolbar__settings-btn').click();
  const choices = holder
    .locator('.ce-popover-item__title')
    .filter({ hasText: /^Heading [1-6]$/ });
  await expect(choices).toHaveText(['Heading 2', 'Heading 3']);
  await choices.filter({ hasText: 'Heading 3' }).click();
  await expect(holder.locator('h3.ce-header')).toHaveText('Article heading');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator('output').innerText()) || '{}').blocks,
    )
    .toMatchObject([
      { type: 'header', data: { text: '<i>Article heading</i>', level: 3 } },
    ]);
  await heading.fill('Discard this edit');
  await page.getByRole('button', { name: 'Render saved' }).click();
  await expect(holder.locator('h3.ce-header i')).toHaveText('Article heading');
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(heading).toHaveAttribute('contenteditable', 'false');
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(heading).toHaveAttribute('contenteditable', 'true');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(holder.locator('h2.ce-header')).toBeEmpty();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(
      async () => JSON.parse(await page.locator('output').innerText()).blocks,
    )
    .toEqual([]);
  await heading.click();
  await holder.locator('.ce-toolbar__plus').click();
  await expect(
    holder.getByText('Section heading', { exact: true }),
  ).toBeVisible();
  await holder.getByText('Section heading', { exact: true }).click();
  await expect(holder.locator('h2.ce-header').last()).toBeVisible();
  const singleton = page.locator('#singleton h4.ce-header');
  await expect(singleton).toBeVisible();
  await singleton.fill('Single level');
  await page.getByRole('button', { name: 'Save singleton' }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator('#singleton-output').innerText()) || '{}',
        ).blocks,
    )
    .toMatchObject([
      { type: 'title', data: { text: 'Single level', level: 4 } },
    ]);
  await expect(page.locator('#defaults h2.ce-header')).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(holder).toBeEmpty();
  await expect(page.locator('#singleton')).toBeEmpty();
  await expect(page.locator('#defaults')).toBeEmpty();
});
