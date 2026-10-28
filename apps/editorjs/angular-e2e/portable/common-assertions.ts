import { expect, type Locator, type Page } from '@playwright/test';
import { owner } from './assertions.js';
export const names = ['paragraph', 'header', 'list', 'quote', 'image'];
export async function saveCommon(root: Locator) {
  const previous = await root.getByTestId('registry-saved').textContent();
  await root
    .getByRole('button', { name: 'Save registry', exact: true })
    .click();
  await expect(root.getByTestId('registry-saved')).not.toHaveText(
    previous ?? '',
  );
  return JSON.parse(await root.getByTestId('registry-saved').innerText());
}
export async function commonBehavior(
  page: Page,
  root = owner(page),
  forms = false,
) {
  await expect(root.getByTestId('registry-ready')).toHaveText(
    forms ? 'true' : '1',
  );
  await expect(root.locator('.ce-block')).toHaveCount(5);
  await expect(root.locator('.ce-paragraph')).toHaveAttribute(
    'data-placeholder-active',
    /packaged paragraph/,
  );
  const purpose = root.getByLabel('Image purpose');
  const alt = root.getByLabel('Alternative text', { exact: true });
  await expect(purpose).toHaveValue('unset');
  const original = await saveCommon(root);
  expect(original.blocks.map((b: { type: string }) => b.type)).toEqual(names);
  expect(original.blocks[4].data).not.toHaveProperty('alt');
  await expect(root.getByTestId('rendered-image')).not.toHaveAttribute('alt');
  await root.locator('.ce-paragraph').fill('Edited paragraph');
  await root.locator('.ce-header').fill('Edited heading');
  await root.locator('.cdx-list__item-content').fill('Edited item');
  await root.locator('.cdx-quote__text').fill('Edited quote');
  await root.locator('.cdx-quote__caption').fill('Edited attribution');
  await root.locator('.image-tool__caption').fill('Independent caption');
  await purpose.selectOption('description');
  await purpose.focus();
  await purpose.press('Tab');
  await expect(alt).toBeFocused();
  await alt.fill('A red');
  await alt.press('End');
  await alt.press('Enter');
  await alt.pressSequentially('<square>');
  await expect(root.locator('.ce-block')).toHaveCount(5);
  await root.locator('.anarchitects-image').dispatchEvent('fixture-upload');
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.uploadFinished ?? 0))
    .toBe(1);
  const data = await saveCommon(root);
  expect(data.blocks).toMatchObject([
    { type: 'paragraph', data: { text: 'Edited paragraph' } },
    { type: 'header', data: { text: 'Edited heading', level: 2 } },
    { type: 'list', data: { items: [{ content: 'Edited item' }] } },
    {
      type: 'quote',
      data: { text: 'Edited quote', caption: 'Edited attribution' },
    },
    {
      type: 'image',
      data: {
        alt: 'A red\n<square>',
        caption: 'Independent caption',
        file: { metadata: { literal: '<host>', uploaded: true } },
      },
    },
  ]);
  await expect(root.getByTestId('rendered-image')).toHaveAttribute(
    'alt',
    'A red\n<square>',
  );
  if (!forms) {
    await root.getByRole('button', { name: 'Render saved' }).click();
    await expect(alt).toHaveValue('A red\n<square>');
    await expect(root.locator('.ce-paragraph')).toHaveText('Edited paragraph');
    await expect(root.locator('.ce-header')).toHaveText('Edited heading');
    await expect(root.locator('.cdx-list__item-content')).toHaveText(
      'Edited item',
    );
    await expect(root.locator('.cdx-quote__text')).toHaveText('Edited quote');
    await expect(root.locator('.image-tool__caption')).toHaveText(
      'Independent caption',
    );
  }
  await root.getByRole('button', { name: 'Read only', exact: true }).click();
  await expect(purpose).toBeDisabled();
  await expect(alt).toBeDisabled();
  await expect(root.locator('.image-tool__caption')).toHaveAttribute(
    'contenteditable',
    'false',
  );
  await root.getByRole('button', { name: 'Read only', exact: true }).click();
  await purpose.selectOption('decorative');
  expect((await saveCommon(root)).blocks[4].data.alt).toBe('');
  await expect(root.getByTestId('rendered-image')).toHaveAttribute('alt', '');
  if (!forms) {
    await root.getByRole('button', { name: 'Render saved' }).click();
    await expect(purpose).toHaveValue('decorative');
  }
  await purpose.selectOption('unset');
  expect((await saveCommon(root)).blocks[4].data).not.toHaveProperty('alt');
  await expect(root.getByTestId('rendered-image')).not.toHaveAttribute('alt');
}
export async function commonLifetime(page: Page) {
  const a = owner(page),
    b = owner(page, 'B');
  await expect(a.getByTestId('registry-ready')).toHaveText('1');
  await expect(b.getByTestId('registry-ready')).toHaveText('1');
  const evaluated = await page.evaluate(() => window.registryProbe?.evaluated);
  expect([...(evaluated ?? [])].sort()).toEqual(
    names.map((name) => 'common-' + name).sort(),
  );
  const toggle = page.getByRole('button', {
    name: 'Toggle registry A',
    exact: true,
  });
  await page.evaluate(() => {
    if (!window.registryProbe) throw new Error('Missing registry probe');
    window.registryProbe.holdUpload = true;
  });
  await a.locator('.anarchitects-image').dispatchEvent('fixture-upload');
  await expect
    .poll(() => page.evaluate(() => !!window.registryProbe?.releaseUpload))
    .toBe(true);
  await toggle.click();
  await page.evaluate(() => window.registryProbe?.releaseUpload?.());
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.uploadFinished))
    .toBe(1);
  await expect(a).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.destroyed))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.blockDestroyed))
    .toBe(5);
  await page
    .getByRole('button', { name: 'Fail next tool', exact: true })
    .click();
  await toggle.click();
  await expect(a.getByTestId('registry-error')).toContainText(
    'load:operation-failed',
  );
  await toggle.click();
  await page
    .getByRole('button', { name: 'Hold next tool', exact: true })
    .click();
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => !!window.registryProbe?.release))
    .toBe(true);
  await toggle.click();
  await page.evaluate(() => window.registryProbe?.release?.());
  await toggle.click();
  await expect(a.getByTestId('registry-ready')).toHaveText('1');
  expect(await page.evaluate(() => window.registryProbe?.created)).toBe(3);
  expect(await page.evaluate(() => window.registryProbe?.evaluated)).toEqual(
    evaluated,
  );
  await b.locator('.ce-paragraph').fill('Surviving owner');
  expect((await saveCommon(b)).blocks[0].data.text).toBe('Surviving owner');
  await expect(a.locator('.ce-paragraph')).not.toContainText('Surviving owner');
}
