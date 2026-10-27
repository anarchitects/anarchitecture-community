import { expect, type Page } from '@playwright/test';
// Browser bridge contract; no runtime or source import from the host project.
declare global {
  interface Window {
    registryProbe?: {
      evaluated: string[];
      loads: string[];
      created: number;
      destroyed: number;
      blockCreated: number;
      blockDestroyed: number;
      release?: () => void;
    };
  }
}
export const owner = (page: Page, label = 'A') =>
  page.locator(`[data-registry-owner="${label}"]`);

export async function behavior(page: Page, label: string) {
  const a = owner(page),
    b = owner(page, 'B');
  await expect(a.getByTestId('registry-ready')).toHaveText('1');
  await expect(b.getByTestId('registry-ready')).toHaveText('1');
  expect(await page.evaluate(() => window.registryProbe?.created)).toBe(2);
  expect(
    await page.evaluate(() => window.registryProbe?.evaluated.sort()),
  ).toEqual(['card', 'flag', 'marker']);
  await expect(a.locator('.registry-card')).toHaveAttribute(
    'data-label',
    label,
  );
  await expect(a.locator('[data-tune-label]')).toHaveAttribute(
    'data-tune-label',
    label,
  );
  await expect(a.locator('.ce-paragraph')).toContainText('paragraph');
  const editable = a.locator('.registry-card');
  await editable.fill('Owned text');
  await editable.selectText();
  await editable.dispatchEvent('mouseup', { bubbles: true });
  await a.getByRole('button', { name: 'Registry mark', exact: true }).click();
  await expect(editable.locator('mark')).toHaveText('Owned text');
  await editable.click();
  await editable.hover();
  await a.locator('.ce-toolbar__settings-btn').click();
  await a.getByText('Registry flag', { exact: true }).click();
  await expect(a.locator('[data-flagged]')).toHaveAttribute(
    'data-flagged',
    'true',
  );
  await a.getByRole('button', { name: 'Save registry', exact: true }).click();
  await expect(a.getByTestId('registry-saved')).toContainText('Owned text');
  const data = JSON.parse(await a.getByTestId('registry-saved').innerText());
  expect(data.blocks[0].type).toBe('card');
  expect(data.blocks[0].data.text).toContain('<mark');
  expect(data.blocks[0].tunes.flag).toEqual({ flagged: true });
  expect(data.blocks[1].type).toBe('paragraph');
  await expect(b.locator('.registry-card')).not.toContainText('Owned text');
  // Editor.js built-in formatting remains available alongside the selected custom inline tool.
  await a.locator('.ce-paragraph').fill('Builtin bold');
  await a.locator('.ce-paragraph').selectText();
  await a.locator('.ce-paragraph').dispatchEvent('mouseup', { bubbles: true });
  await a.locator('[data-item-name="bold"]').click();
  await expect(a.locator('.ce-paragraph b')).toHaveText('Builtin bold');
  await a.locator('.ce-paragraph').click();
  await a.locator('.ce-paragraph').hover();
  await a.locator('.ce-toolbar__settings-btn').click();
  await a.locator('[data-item-name="move-up"]').click();
  await expect(
    a.locator('.ce-block').first().locator('.ce-paragraph'),
  ).toContainText('Builtin bold');
  await a.getByRole('button', { name: 'Save registry', exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(await a.getByTestId('registry-saved').innerText()).blocks[0]
          .type,
    )
    .toBe('paragraph');
}

export async function lifetime(page: Page) {
  const a = owner(page),
    b = owner(page, 'B');
  await expect(a.getByTestId('registry-ready')).toHaveText('1');
  await expect(b.getByTestId('registry-ready')).toHaveText('1');
  const toggle = page.getByRole('button', {
    name: 'Toggle registry A',
    exact: true,
  });
  await toggle.click();
  await expect(a).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.destroyed))
    .toBe(1);
  await page
    .getByRole('button', { name: 'Fail next tool', exact: true })
    .click();
  await toggle.click();
  await expect(a.getByTestId('registry-error')).toContainText(
    'load:operation-failed',
  );
  await expect(a.getByTestId('registry-ready')).toHaveText('0');
  expect(await page.evaluate(() => window.registryProbe?.created)).toBe(2);
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
  // Editor.js 2.31.7 also constructs one non-rendered tool per editor when
  // discovering paste handlers. Count those separately from raw editors.
  expect(await page.evaluate(() => window.registryProbe?.blockCreated)).toBe(6);
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.destroyed))
    .toBe(1);
  await expect(b.getByTestId('registry-ready')).toHaveText('1');
  await expect(a.locator('.registry-card')).toContainText('A custom');
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.destroyed))
    .toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.blockDestroyed))
    .toBe(2);
  expect(
    await page.evaluate(() =>
      window.registryProbe?.evaluated.includes('unselected'),
    ),
  ).toBe(false);
}
