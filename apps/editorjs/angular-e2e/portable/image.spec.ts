import { test, expect } from '../hydration/fixture.js';

test('packed image authors alt independently, uploads files/URLs and round trips settings', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname.slice(1)),
  );
  await page.goto('/image.html');
  const graph: { chunks: string[] } = await (
    await page.request.get('/image-graph.json')
  ).json();
  expect(graph.chunks.some((file) => requests.includes(file))).toBe(false);
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const holder = page.locator('#editor');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  expect(graph.chunks.every((file) => requests.includes(file))).toBe(true);
  const mode = holder.getByLabel('Image purpose');
  const alt = holder.getByLabel('Alternative text', { exact: true });
  const caption = holder.locator('.image-tool__caption');
  const save = async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(holder).toHaveAttribute('data-command', 'save');
    return JSON.parse(await page.locator('output').innerText()).blocks[0].data;
  };
  await expect(mode).toHaveValue('unset');
  expect(await save()).not.toHaveProperty('alt');
  await mode.selectOption('description');
  await alt.fill('A red');
  await alt.press('End');
  await alt.press('Enter');
  await alt.pressSequentially('<square>');
  await expect(alt).toHaveValue('A red\n<square>');
  await expect(holder.locator('.ce-block')).toHaveCount(1);
  await caption.fill('Visible caption');
  await page.getByRole('button', { name: 'Upload URL', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-upload-finished',
    'url',
  );
  await expect.poll(async () => (await save()).file.id).toBe('url');
  expect(await save()).toMatchObject({
    alt: 'A red\n<square>',
    caption: 'Visible caption',
    file: {
      id: 'url',
      meta: { width: 80, owned: true, label: '<host-metadata>' },
    },
  });
  await expect(holder.locator('img').last()).toHaveAttribute(
    'alt',
    'A red\n<square>',
  );
  for (const label of ['With border', 'Stretch image', 'With background']) {
    await caption.click();
    await holder.locator('.ce-toolbar__settings-btn').click();
    await holder.getByText(label, { exact: true }).click();
  }
  expect(await save()).toMatchObject({
    withBorder: true,
    stretched: true,
    withBackground: true,
  });
  await page.getByRole('button', { name: 'Render saved' }).click();
  await expect(alt).toHaveValue('A red\n<square>');
  await expect(caption).toHaveText('Visible caption');
  expect(await save()).toMatchObject({
    alt: 'A red\n<square>',
    withBorder: true,
    stretched: true,
    withBackground: true,
    file: { id: 'url' },
  });
  await page.getByRole('button', { name: 'Read only' }).click();
  await expect(mode).toBeDisabled();
  await expect(alt).toBeDisabled();
  await expect(caption).toHaveAttribute('contenteditable', 'false');
  await page.getByRole('button', { name: 'Read only' }).click();
  await mode.selectOption('decorative');
  expect((await save()).alt).toBe('');
  await page.getByRole('button', { name: 'Render saved' }).click();
  await expect(mode).toHaveValue('decorative');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(holder.locator('.cdx-button')).toBeVisible();
  await mode.selectOption('description');
  await alt.fill('Uploaded red square');
  const chooser = page.waitForEvent('filechooser');
  await holder.locator('.cdx-button').click();
  await (
    await chooser
  ).setFiles({
    name: 'red.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="red"/></svg>',
    ),
  });
  await expect(holder.locator('img')).toBeVisible();
  await expect.poll(async () => (await save()).file.id).toBe('file');
  expect((await save()).alt).toBe('Uploaded red square');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(holder).toBeEmpty();
});

test('packed uploads fail visibly and pending success cannot revive a removed owner', async ({
  page,
}) => {
  await page.goto('/image.html');
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const holder = page.locator('#editor');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  for (const mode of ['failure', 'reject', 'malformed']) {
    await page.getByLabel('Upload outcome').selectOption(mode);
    await page.getByRole('button', { name: 'Upload URL', exact: true }).click();
    await expect(
      page.getByText('Couldn’t upload image. Please try another.').last(),
    ).toBeVisible();
  }
  await page.getByLabel('Upload outcome').selectOption('pending');
  await page.getByRole('button', { name: 'Upload URL', exact: true }).click();
  await expect(holder).toHaveAttribute('data-command', 'upload-url');
  await page.getByRole('button', { name: 'Remove main' }).click();
  await expect(holder).toBeEmpty();
  await page.getByRole('button', { name: 'Release uploads' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-upload-finished',
    'url',
  );
  const second = page.locator('#second');
  await second.getByLabel('Image purpose').selectOption('description');
  await second
    .getByLabel('Alternative text', { exact: true })
    .fill('Independent');
  await page.getByRole('button', { name: 'Save second' }).click();
  await expect(page.locator('#second-output')).toContainText('Independent');
  await expect(holder).toBeEmpty();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
});

test('a fast file failure leaves the empty image ready for another selection', async ({
  page,
}) => {
  await page.goto('/image.html');
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  const holder = page.locator('#editor');
  await expect(holder).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Upload outcome').selectOption('failure');
  const chooser = page.waitForEvent('filechooser');
  await holder.locator('.cdx-button').click();
  await (
    await chooser
  ).setFiles({
    name: 'red.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(
    page.getByText('Couldn’t upload image. Please try another.'),
  ).toBeVisible();
  await expect(holder.locator('.cdx-button')).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
});
