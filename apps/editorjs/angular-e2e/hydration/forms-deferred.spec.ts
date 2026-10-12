import { readFile } from 'node:fs/promises';
import { workspaceRoot } from '@nx/devkit';
import {
  test,
  expect,
  bootstrap,
  retained,
  held,
  release,
  events,
} from './fixture.js';

for (const mode of ['deferred', 'incremental']) {
  test(`${mode} forms activate once and submit only after explicit current snapshot capture`, async ({
    page,
  }) => {
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') posts.push(request.url());
    });
    await bootstrap(
      page,
      `/forms-${mode}?marker=${mode}-form`,
      [{ owner: 'A', point: 'ready' }],
      mode === 'incremental' ? 1 : 0,
    );
    await expect(page.locator('main')).toHaveAttribute('data-rendered', 'true');
    expect(await page.evaluate(() => window.hydrationTest.sessions)).toEqual(
      [],
    );
    if (mode === 'incremental') {
      await expect(
        page.getByRole('button', { name: 'Submit fixture' }),
      ).toBeDisabled();
      expect(
        await page
          .locator('form')
          .evaluate((node) => [
            ...new FormData(node as HTMLFormElement).entries(),
          ]),
      ).toEqual([]);
      await retained(page);
    } else await expect(page.locator('form')).toHaveCount(0);
    await page.getByRole('button', { name: 'Activate form' }).focus();
    await page.keyboard.press('Enter');
    await held(page, 'ready');
    await expect(
      page.getByRole('button', { name: 'Submit fixture' }),
    ).toBeDisabled();
    await expect(page.getByRole('textbox')).toBeDisabled();
    await expect(page.getByTestId('form-state')).toHaveAttribute(
      'data-dirty',
      'false',
    );
    await expect(page.getByTestId('form-state')).toHaveAttribute(
      'data-touched',
      'false',
    );
    await release(page);
    await expect(page.getByTestId('ready-count')).toHaveText('1');
    await retained(page);
    if (mode === 'incremental')
      await expect(page.getByTestId('activations')).toHaveText('1');
    await expect(page.getByTestId('submissions')).toHaveText('0');
    await expect(page.getByTestId('changes')).toHaveText('0');
    await page.locator('.ce-paragraph').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' activated keyboard edit');
    await expect(page.getByTestId('value')).toContainText(
      'activated keyboard edit',
    );
    await page.getByRole('textbox').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('captured')).toContainText(
      'activated keyboard edit',
    );
    await expect(page.getByTestId('submissions')).toHaveText('1');
    await page.getByRole('button', { name: 'Complete submission' }).click();
    await expect(page.getByTestId('result')).toHaveText('Submitted');
    expect(posts).toEqual([]);
    expect((await events(page)).filter((e) => e === 'created')).toHaveLength(1);
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect.poll(() => events(page)).toContain('destroyed');
    await page
      .getByRole('link', {
        name: mode === 'deferred' ? 'Deferred Forms' : 'Incremental Forms',
        exact: true,
      })
      .click();
    await expect(page.locator('aa-editorjs')).toHaveCount(0);
    await page.getByRole('button', { name: 'Activate form' }).click();
    await expect(page.getByTestId('ready-count')).toHaveText('1');
    await expect(page.getByTestId('submissions')).toHaveText('0');
    await expect(page.getByTestId('form-state')).toHaveAttribute(
      'data-dirty',
      'false',
    );
  });
}

test('incremental form stays safe during held view activation and replays its host click once', async ({
  page,
}, testInfo) => {
  const stats = JSON.parse(
    await readFile(
      `${workspaceRoot}/${testInfo.project.metadata['buildDirectory']}/stats.json`,
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
          input.endsWith('/ssr/forms-editor.ts'),
        ),
    )
    .map(([name]) => name);
  expect(assets).toHaveLength(1);
  await bootstrap(page, '/forms-incremental?marker=held-view');
  await expect(page.locator('main')).toHaveAttribute('data-rendered', 'true');
  let resume!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const request = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route(`**/${assets[0]}`, async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await page.getByRole('button', { name: 'Activate form' }).click();
  await request;
  expect(await page.evaluate(() => window.hydrationTest.sessions)).toEqual([]);
  await expect(page.locator('aa-editorjs > div')).toBeEmpty();
  await expect(
    page.getByRole('button', { name: 'Submit fixture' }),
  ).toBeDisabled();
  await expect(page.getByRole('textbox')).toBeDisabled();
  expect(
    await page
      .locator('form')
      .evaluate((node) => [...new FormData(node as HTMLFormElement).entries()]),
  ).toEqual([]);
  const box = await page
    .getByRole('button', { name: 'Submit fixture' })
    .boundingBox();
  if (!box) throw new Error('Expected SSR submit button');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // Enter on the disabled submit surface has no native form action.
  await page.keyboard.press('Enter');
  resume();
  await expect(page.getByTestId('ready-count')).toHaveText('1');
  await expect(page.getByTestId('activations')).toHaveText('1');
  await expect(page.getByTestId('submissions')).toHaveText('0');
  await expect(page.getByTestId('changes')).toHaveText('0');
  await retained(page);
  await expect(page).toHaveURL(/\/forms-incremental\?marker=held-view$/);
  expect(posts).toEqual([]);
});
