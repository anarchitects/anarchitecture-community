import {
  test,
  expect,
  bootstrap,
  retained,
  card,
  paragraph,
  ready,
  held,
  release,
  events,
} from './fixture.js';

for (const mode of ['deferred', 'incremental']) {
  test(`${mode} activates once on interaction and uses its ordinary trigger on navigation`, async ({
    page,
  }) => {
    await bootstrap(
      page,
      `/${mode}?marker=${mode}`,
      [],
      mode === 'deferred' ? 0 : 1,
    );
    await expect(page.locator('main')).toHaveAttribute('data-rendered', 'true');
    expect(await page.evaluate(() => window.hydrationTest.sessions)).toEqual(
      [],
    );
    await expect(page.getByTestId('placeholder')).toHaveCount(
      mode === 'deferred' ? 1 : 0,
    );
    await expect(page.locator('aa-editorjs > div:not(:empty)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Activate editor' }).click();
    await ready(page);
    await retained(page);
    await expect(paragraph(page)).toContainText(mode);
    expect((await events(page)).filter((e) => e === 'created')).toHaveLength(1);
    await expect(
      page.getByTestId('activated').filter({ hasText: 'true' }),
    ).toHaveCount(mode === 'incremental' ? 1 : 0);
    await paragraph(page).click();
    await page.keyboard.type(' deferred edit');
    await expect(card(page).getByTestId('last-change')).toContainText(
      'deferred edit',
    );
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect.poll(() => events(page)).toContain('destroyed');
    await page
      .getByRole('link', {
        name: mode === 'deferred' ? 'Deferred' : 'Incremental',
        exact: true,
      })
      .click();
    await expect(page.locator('aa-editorjs')).toHaveCount(0);
    await page.getByRole('button', { name: 'Activate editor' }).click();
    await ready(page);
    await expect(paragraph(page)).toContainText('public-default');
    expect((await events(page, 1)).filter((e) => e === 'created')).toHaveLength(
      1,
    );
  });

  test(`${mode} destruction before activation and during module loading abandons the owner`, async ({
    page,
  }) => {
    await bootstrap(
      page,
      `/${mode}`,
      [{ owner: 'A', point: 'load' }],
      mode === 'deferred' ? 0 : 1,
    );
    await expect(page.locator('main')).toHaveAttribute('data-rendered', 'true');
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    expect(await page.evaluate(() => window.hydrationTest.sessions)).toEqual(
      [],
    );
    await page
      .getByRole('link', {
        name: mode === 'deferred' ? 'Deferred' : 'Incremental',
        exact: true,
      })
      .click();
    await page.getByRole('button', { name: 'Activate editor' }).click();
    await held(page, 'load');
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect.poll(() => events(page)).toContain('owner-destroyed');
    await release(page);
    await expect.poll(() => events(page)).toContain('loaded');
    expect(await events(page)).not.toContain('created');
    expect((await events(page)).filter((e) => e.startsWith('output-'))).toEqual(
      [],
    );
  });
}

test('ordinary defer shows loading and an actionable error on failed view delivery', async ({
  page,
}, testInfo) => {
  const { readFile } = await import('node:fs/promises');
  const stats = JSON.parse(
    await readFile(
      `${testInfo.project.metadata['buildDirectory']}/stats.json`,
      'utf8',
    ),
  ) as {
    outputs: Record<string, { inputs: Record<string, unknown> }>;
  };
  const assets = Object.entries(stats.outputs)
    .filter(
      ([name, entry]) =>
        name.endsWith('.js') &&
        Object.keys(entry.inputs).some((input) =>
          input.endsWith('/ssr/standalone-editor.ts'),
        ),
    )
    .map(([name]) => name);
  expect(assets).toHaveLength(1);
  await bootstrap(page, '/deferred', [], 0);
  await expect(page.locator('main')).toHaveAttribute('data-rendered', 'true');
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route(`**/${assets[0]}`, async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: 'throw new Error("Injected deferred view failure");',
    });
  });
  await page.getByRole('button', { name: 'Activate editor' }).click();
  await expect(page.getByTestId('loading')).toBeVisible();
  expect(await page.evaluate(() => window.hydrationTest.sessions)).toEqual([]);
  finish();
  await expect(page.getByRole('alert')).toContainText('Editor view failed');
  expect(await page.evaluate(() => window.hydrationTest.sessions)).toEqual([]);
  // Reload clears the browser's failed module cache, then activation can retry delivery.
  await page.unroute(`**/${assets[0]}`);
  await page.reload();
  await page.getByRole('button', { name: 'Activate editor' }).click();
  await ready(page);
});
