import { test, expect, bootstrap } from './fixture.js';
import {
  commonBehavior,
  commonLifetime,
} from '../portable/common-assertions.js';
test('real five-tool holders survive hydration with shared editing and alt semantics', async ({
  page,
}) => {
  await bootstrap(page, '/tools?marker=common-request', [], 2);
  await commonBehavior(page);
  expect(
    await page.evaluate(() =>
      window.hydrationTest.nodes.every((node) => node.isConnected),
    ),
  ).toBe(true);
  await expect(page.getByTestId('registry-names')).toHaveText(
    'paragraph,header,list,quote,image',
  );
});
test('hydrated five-tool owners fence lazy failures and pending uploads', async ({
  page,
}) => {
  await page.goto('/tools');
  await commonLifetime(page);
  await expect(page.locator('[data-registry-owner="B"] .ce-block')).toHaveCount(
    5,
  );
});
test('native Forms owns five-tool dirty touched reset readonly and disabled state', async ({
  page,
}) => {
  await bootstrap(page, '/tools/forms?marker=common-forms');
  const root = page.locator('aa-registry-forms-page');
  await expect(page.getByTestId('registry-dirty')).toHaveText('false');
  await expect(page.getByTestId('registry-touched')).toHaveText('false');
  await commonBehavior(page, root, true);
  await expect(page.getByTestId('registry-dirty')).toHaveText('true');
  await expect(page.getByTestId('registry-touched')).toHaveText('true');
  await page.getByRole('button', { name: 'Disable', exact: true }).click();
  await expect(page.getByTestId('registry-disabled')).toHaveText('true');
  await expect(page.getByLabel('Image purpose')).toBeDisabled();
  await expect(page.locator('.ce-paragraph')).toHaveAttribute(
    'contenteditable',
    'false',
  );
  await page.getByRole('button', { name: 'Disable', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.ce-paragraph')).toHaveText(
    'common-forms paragraph',
  );
  await expect(page.getByLabel('Image purpose')).toHaveValue('unset');
  await expect(page.getByTestId('registry-dirty')).toHaveText('false');
  await expect(page.getByTestId('registry-touched')).toHaveText('false');
  expect(await page.evaluate(() => window.registryProbe?.created)).toBe(1);
  await page.getByRole('link', { name: 'Public', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.destroyed))
    .toBe(1);
});
