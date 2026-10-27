import type { Page } from '@playwright/test';
import { test, expect } from './fixture.js';
import { arm, held, release, events } from '../hydration/fixture.js';
import { fixturePort } from '../tools/ssr-environment.mjs';

/** A bounded idle observation, not a timer-based application activation policy. */
async function idleWindow(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('data-rendered', 'true');
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestIdleCallback(() => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await new Promise<void>((resolve) => requestIdleCallback(() => resolve()));
  });
}

for (const path of ['/', '/sample/public']) {
  test(`cold public load and client navigation stay isolated while idle: ${path}`, async ({
    page,
    graph,
    delivery,
  }, testInfo) => {
    graph.assertIsolated();
    const response = await page.goto(path);
    if (!response) throw new Error('Expected public HTML');
    await testInfo.attach('public-html', {
      body: await response.text(),
      contentType: 'text/html',
    });
    await idleWindow(page);
    delivery.assertPublic(await delivery.checkpoint('cold public idle'));
    const initialDocument = await page.locator('aa-root').elementHandle();
    await page
      .getByRole('link', {
        name: path === '/' ? 'Public sample' : 'Public',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(path === '/' ? /\/sample\/public$/ : /\/$/);
    await expect(
      page.getByRole('heading', { name: 'Public page' }),
    ).toBeVisible();
    await idleWindow(page);
    expect(
      await initialDocument!.evaluate(
        (node) => node === document.querySelector('aa-root'),
      ),
    ).toBe(true);
    delivery.assertPublic(
      await delivery.checkpoint('public client navigation idle'),
    );
    await expect(page.locator('aa-editorjs')).toHaveCount(0);
  });
}

const routes = [
  { link: 'Standalone', forms: false, activate: false },
  { link: 'Signal Forms', forms: true, activate: false },
  { link: 'Deferred', forms: false, activate: true },
  { link: 'Deferred Forms', forms: true, activate: true },
  { link: 'Incremental', forms: false, activate: true },
  { link: 'Incremental Forms', forms: true, activate: true },
];
for (const route of routes) {
  test(`${route.link} delivers the runtime on demand, edits, and disposes across re-entry`, async ({
    page,
    graph,
    delivery,
  }) => {
    graph.assertIsolated();
    await page.goto('/');
    await idleWindow(page);
    delivery.assertPublic(await delivery.checkpoint('public before authoring'));
    const card = page.locator(
      `${route.forms ? 'aa-forms-editor' : 'aa-standalone-editor'}[data-owner="A"]`,
    );
    let resume!: () => void;
    let requested!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const request = new Promise<void>((resolve) => {
      requested = resolve;
    });
    const matcher = (url: URL) => graph.runtime.includes(url.pathname.slice(1));
    await page.route(matcher, async (interception) => {
      requested();
      await gate;
      await interception.continue();
    });
    try {
      await page.getByRole('link', { name: route.link, exact: true }).click();
      if (route.activate) {
        await expect(
          page.getByRole('button', {
            name: route.forms ? 'Activate form' : 'Activate editor',
            exact: true,
          }),
        ).toBeVisible();
        await idleWindow(page);
        delivery.assertPublic(
          await delivery.checkpoint('deferred view before activation'),
        );
        await page
          .getByRole('button', {
            name: route.forms ? 'Activate form' : 'Activate editor',
            exact: true,
          })
          .click();
      }
      await request;
      const pending = await delivery.checkpoint(
        'runtime request held before delivery',
      );
      expect(pending.runtimeRequests.length).toBeGreaterThan(0);
      expect(pending.runtimeResponses).toEqual([]);
      expect(pending.runtimeEvaluated).toEqual([]);
      expect(pending.sessions).toHaveLength(1);
      expect(pending.sessions[0].events).not.toContain('created');
    } finally {
      resume();
    }
    await expect(card.getByTestId('ready-count')).toHaveText('1');
    const active = await delivery.checkpoint(
      'runtime delivered and editor ready',
    );
    expect(active.runtimeResponses.length).toBeGreaterThan(0);
    expect(active.runtimeEvaluated.length).toBeGreaterThan(0);
    expect(
      active.sessions[0].events.filter((event) => event === 'created'),
    ).toHaveLength(1);
    await card.locator('.ce-paragraph').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' isolation edit');
    await expect(
      card.getByTestId(route.forms ? 'value' : 'last-change'),
    ).toContainText('isolation edit');
    await arm(page, { owner: 'A', point: 'save' });
    await card
      .getByRole('button', {
        name: route.forms ? 'Capture snapshot' : 'save',
        exact: true,
      })
      .click();
    await held(page, 'save');
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect.poll(() => events(page)).toContain('destroyed');
    const oldOutputs = (await events(page)).filter((event) =>
      event.startsWith('output-'),
    );
    await expect(page.locator('aa-editorjs')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Public page' }),
    ).toBeVisible();
    const exited = await delivery.checkpoint(
      'public after disposal; modules remain cached',
    );
    expect(exited.runtimeRequests).toEqual(active.runtimeRequests);
    expect(exited.runtimeEvaluated).toEqual(active.runtimeEvaluated);
    await page.getByRole('link', { name: route.link, exact: true }).click();
    if (route.activate)
      await page
        .getByRole('button', {
          name: route.forms ? 'Activate form' : 'Activate editor',
          exact: true,
        })
        .click();
    await expect(card.getByTestId('ready-count')).toHaveText('1');
    await release(page);
    await page.evaluate(() => window.hydrationTest.sessions[0].notify?.());
    await expect.poll(() => events(page)).toContain('save-settled');
    expect(
      (await events(page)).filter((event) => event.startsWith('output-')),
    ).toEqual(oldOutputs);
    await expect(card.getByTestId('changes')).toHaveText('0');
    await expect(card.locator('.ce-paragraph')).not.toContainText(
      'isolation edit',
    );
    const reentered = await delivery.checkpoint(
      'new owner using cached module',
    );
    expect(reentered.runtimeRequests).toEqual(active.runtimeRequests);
    expect(reentered.sessions).toHaveLength(2);
    expect(
      reentered.sessions[1].events.filter((event) => event === 'created'),
    ).toHaveLength(1);
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect.poll(() => events(page, 1)).toContain('destroyed');
    await page.unroute(matcher);
  });
}

test('explicit host module preload downloads without evaluation and violates the public delivery policy', async ({
  page,
  graph,
  delivery,
}) => {
  graph.assertIsolated();
  await page.goto('/');
  await idleWindow(page);
  delivery.assertPublic(
    await delivery.checkpoint('before explicit host preload'),
  );
  await page.evaluate(async (asset) => {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = `/${asset}`;
    await new Promise<void>((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('Module preload failed'));
      document.head.append(link);
    });
  }, graph.runtime[0]);
  const preloaded = await delivery.checkpoint('explicit preload completed');
  expect(preloaded.runtimeResponses.length).toBeGreaterThan(0);
  expect(preloaded.runtimeHints.length).toBeGreaterThan(0);
  expect(preloaded.runtimeEvaluated).toEqual([]);
  expect(preloaded.sessions).toEqual([]);
  expect(() => delivery.assertPublic(preloaded)).toThrow(
    'Editor.js runtime was requested',
  );
});

test.describe('deliberately eager production negative control', () => {
  test.use({ eager: true });
  test('the same graph and browser assertions detect eager delivery and evaluation without instantiation', async ({
    page,
    graph,
    delivery,
  }) => {
    expect(() => graph.assertIsolated()).toThrow(
      'Editor.js runtime enters the public eager dependency closure',
    );
    await page.goto(`http://127.0.0.1:${fixturePort(4)}/`);
    await idleWindow(page);
    const eager = await delivery.checkpoint(
      'eager negative control public idle',
    );
    expect(eager.runtimeRequests.length).toBeGreaterThan(0);
    expect(eager.runtimeEvaluated.length).toBeGreaterThan(0);
    expect(eager.sessions).toEqual([]);
    expect(
      await page.evaluate(() => window.registryProbe?.evaluated),
    ).toContain('card');
    expect(
      await page.evaluate(
        () =>
          typeof (window as unknown as { isolationEagerEditor: unknown })
            .isolationEagerEditor,
      ),
    ).toBe('function');
    expect(() => delivery.assertPublic(eager)).toThrow(
      'Editor.js runtime was requested',
    );
    await expect(page.locator('aa-editorjs')).toHaveCount(0);
  });
});

test('registry authoring delivers selected tools only and leaves cached code after disposal', async ({
  page,
  graph,
  delivery,
}) => {
  graph.assertIsolated();
  await page.goto('/');
  await idleWindow(page);
  delivery.assertPublic(
    await delivery.checkpoint('before registry activation'),
  );
  expect(
    await page.evaluate(() => window.registryProbe?.evaluated ?? []),
  ).toEqual([]);
  await page.getByRole('link', { name: 'Registry', exact: true }).click();
  await expect(page.getByTestId('registry-ready').first()).toHaveText('1');
  await expect(page.getByTestId('registry-ready').last()).toHaveText('1');
  const active = await delivery.checkpoint('registry activated');
  for (const name of ['card', 'marker', 'flag']) {
    expect(
      active.runtimeResponses.some((url) =>
        graph.tools[name].includes(new URL(url).pathname.slice(1)),
      ),
    ).toBe(true);
    expect(
      active.runtimeEvaluated.some((url) =>
        graph.tools[name].includes(new URL(url).pathname.slice(1)),
      ),
    ).toBe(true);
  }
  expect(
    active.runtimeRequests.some((url) =>
      graph.tools['unselected'].includes(new URL(url).pathname.slice(1)),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() => window.registryProbe?.evaluated.sort()),
  ).toEqual(['card', 'flag', 'marker']);
  await page.getByRole('link', { name: 'Public', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.registryProbe?.destroyed))
    .toBe(2);
  await page.getByRole('link', { name: 'Registry', exact: true }).click();
  await expect(page.getByTestId('registry-ready').first()).toHaveText('1');
  await expect(page.getByTestId('registry-ready').last()).toHaveText('1');
  const remounted = await delivery.checkpoint(
    'registry recreated with cached modules',
  );
  expect(remounted.runtimeRequests).toEqual(active.runtimeRequests);
  expect(await page.evaluate(() => window.registryProbe?.created)).toBe(4);
});
