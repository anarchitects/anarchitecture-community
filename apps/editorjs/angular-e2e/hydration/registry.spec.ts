import { test, expect, bootstrap } from './fixture.js';
import { behavior, lifetime } from '../portable/assertions.js';

test('registry SSR holders survive hydration and the shared tools perform real editing', async ({
  page,
}) => {
  await bootstrap(page, '/registry?marker=registry-request', [], 2);
  await behavior(page, 'registry-request');
  expect(
    await page.evaluate(() =>
      window.hydrationTest.nodes.every((node) => node.isConnected),
    ),
  ).toBe(true);
  await expect(page.getByTestId('registry-names')).toHaveText(
    'card,marker,flag',
  );
});
test('registry editors fence failed and pending tools across removal and recreation', async ({
  page,
}) => {
  await page.goto('/registry');
  await lifetime(page);
  await expect(
    page.locator('[data-registry-owner="B"] .registry-card'),
  ).toBeVisible();
});
test('Signal Forms opts into the same registry without phantom interaction state', async ({
  page,
}) => {
  await bootstrap(page, '/registry/forms?marker=forms-request');
  await expect(page.getByTestId('registry-ready')).toHaveText('true');
  await expect(page.getByTestId('registry-dirty')).toHaveText('false');
  await expect(page.getByTestId('registry-touched')).toHaveText('false');
  await expect(page.locator('.registry-card')).toHaveAttribute(
    'data-label',
    'forms-request',
  );
  await page.locator('.registry-card').fill('Forms registry edit');
  await page
    .getByRole('button', { name: 'Save registry', exact: true })
    .click();
  await expect(page.getByTestId('registry-saved')).toContainText(
    'Forms registry edit',
  );
  await expect(page.getByTestId('registry-dirty')).toHaveText('true');
  expect(await page.evaluate(() => window.registryProbe?.created)).toBe(1);
  await page.getByRole('link', { name: 'Public', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.destroyed))
    .toBe(1);
});
