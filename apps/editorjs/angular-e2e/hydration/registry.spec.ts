import { test, expect, bootstrap } from './fixture.js';
import { behavior, lifetime } from '../portable/assertions.js';
import { packed } from '../tools/ssr-environment.mjs';
import { notebookHydrationCases } from './notebook-cases.js';

notebookHydrationCases();

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

test.describe('archived custom consumers', () => {
  test.skip(
    !packed,
    'Actual published examples are extracted into the packed consumer',
  );
  for (const forms of [false, true]) {
    test(`${forms ? 'Forms' : 'standalone'} waits for explicit activation after hydration and recreates clean owners`, async ({
      page,
    }) => {
      const route = forms ? '/custom-forms' : '/custom';
      await bootstrap(
        page,
        `${route}?marker=custom-request`,
        [],
        0,
        async () => {
          await expect(
            page.getByRole('button', { name: 'Activate custom tools' }),
          ).toBeDisabled();
          await expect(page.locator('.codex-editor')).toHaveCount(0);
        },
      );
      await expect(page.getByTestId('marker')).toHaveText('custom-request');
      await expect(
        page.getByRole('button', { name: 'Activate custom tools' }),
      ).toBeEnabled();
      await expect(page.locator('.codex-editor')).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          window.hydrationTest.nodes.every((node) => node.isConnected),
        ),
      ).toBe(true);
      await page.getByRole('button', { name: 'Activate custom tools' }).click();
      const owner = page.getByRole('region', {
        name: forms ? 'Form editor' : 'Provider editor',
        exact: true,
      });
      const text = owner.locator('.callout-text');
      await expect(text).toBeEditable();
      const save = owner.getByRole('button', {
        name: forms ? 'Save document' : 'Save',
        exact: true,
      });
      await expect(save).toBeEnabled();
      await text.fill('Hydrated custom edit');
      if (forms)
        await expect(owner.getByLabel('Dirty', { exact: true })).toHaveText(
          'true',
        );
      await save.click();
      await expect(
        owner.getByLabel('Saved document', { exact: true }),
      ).toContainText('Hydrated custom edit');
      await expect(owner.locator('textarea.ce-code__textarea')).toHaveCSS(
        'min-height',
        '200px',
      );
      await page.getByRole('link', { name: 'Public', exact: true }).click();
      await expect(page.locator('.codex-editor')).toHaveCount(0);
      await page
        .getByRole('link', {
          name: forms ? 'Custom Forms' : 'Custom tools',
          exact: true,
        })
        .click();
      await expect(page.locator('.codex-editor')).toHaveCount(0);
      await page.getByRole('button', { name: 'Activate custom tools' }).click();
      await expect(text).toHaveText(
        forms ? 'Forms callout' : 'provider callout',
      );
      if (forms) {
        await expect(owner.getByLabel('Dirty', { exact: true })).toHaveText(
          'false',
        );
        await expect(owner.getByLabel('Touched', { exact: true })).toHaveText(
          'false',
        );
      }
    });
  }
  test('navigation during custom Code loading cannot activate an obsolete page', async ({
    page,
  }) => {
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let requested = false;
    await page.route('**/*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('.ce-code__textarea{')) {
        requested = true;
        await gate;
      }
      await route.fulfill({ response, body });
    });
    try {
      await page.goto('/custom');
      await page.getByRole('button', { name: 'Activate custom tools' }).click();
      await expect.poll(() => requested).toBe(true);
      await page.getByRole('link', { name: 'Public', exact: true }).click();
      await expect(page.locator('aa-custom-ssr')).toHaveCount(0);
    } finally {
      resume();
    }
    await page.getByRole('link', { name: 'Custom tools', exact: true }).click();
    await expect(page.locator('.codex-editor')).toHaveCount(0);
    await page.getByRole('button', { name: 'Activate custom tools' }).click();
    await expect(page.locator('.codex-editor')).toHaveCount(2);
    await expect(
      page
        .getByRole('region', { name: 'Provider editor', exact: true })
        .getByRole('status'),
    ).toHaveText('Ready');
  });
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
