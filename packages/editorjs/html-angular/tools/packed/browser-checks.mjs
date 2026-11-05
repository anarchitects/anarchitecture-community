import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect } from '@playwright/test';
import { files, read } from './artifacts.mjs';

export const authoring =
  /(?:@editorjs\/|@anarchitects\/editorjs-(?:angular(?:\/|$)|tool-[^/]+\/browser)|packages\/editorjs\/(?:angular|tool-[^/]+)\/|anarchitects-editorjs-angular)/;
export function assertDisplayInputs(inputs) {
  assert(
    !Object.keys(inputs).some((path) => authoring.test(path)),
    'Authoring code entered display bundle',
  );
}
async function observedPage(browser) {
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' ||
      /NG05\d\d|hydration mismatch/i.test(message.text())
    )
      errors.push(message.text());
  });
  page.on('request', (request) => requests.push(request.url()));
  await page.route(/https:\/\/(assets|attack)\.invalid\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }),
  );
  return { page, errors, requests };
}
async function corpusRoute(browser, origin, route, evidence) {
  const { page, errors, requests } = await observedPage(browser);
  await page.context().tracing.start({ snapshots: true, screenshots: true });
  try {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/*.js', async (request) => {
      await gate;
      await request.continue();
    });
    const response = await page.goto(`${origin}/${route}`, {
      waitUntil: 'commit',
    });
    assert.equal(response.status(), 200);
    writeFileSync(join(evidence, `${route}.html`), await response.text());
    const inspect = () =>
      page.evaluate(() => {
        const rows = [...document.querySelectorAll('.case')];
        for (const row of rows) {
          const expected = document.createElement('div');
          expected.innerHTML = row.getAttribute('data-html') ?? '';
          const status = row.getAttribute('data-status');
          const name = row.getAttribute('data-name');
          if (
            row.querySelector('output')?.textContent?.trim() !==
            `${status}/${status}`
          )
            throw Error(`${name}: result mismatch`);
          for (const actual of [
            row.querySelector('.editorjs-html'),
            row.querySelector('article'),
          ]) {
            if (actual?.innerHTML !== expected.innerHTML)
              throw Error(`${name}: semantic HTML mismatch`);
            if (
              actual.querySelector(
                'script,svg,math,iframe,object,embed,style,[onclick],[onerror],[style]',
              )
            )
              throw Error(`${name}: unsafe DOM`);
          }
        }
        return {
          count: rows.length,
          html: rows.map((row) => [
            row.getAttribute('data-name'),
            row.querySelector('article').innerHTML,
          ]),
          expectedRequests: [
            ...new Set([...document.images].map((image) => image.src)),
          ].sort(),
        };
      });
    let before;
    try {
      if (route === 'corpus-server') {
        await expect(page.locator('#corpus')).toHaveAttribute(
          'data-ready',
          'false',
        );
        await expect(page.locator('.case')).toHaveCount(1169);
        before = await inspect();
        await page.evaluate(() => {
          globalThis.__corpusHosts = [
            ...document.querySelectorAll(
              '.case aa-editorjs-html, .case .editorjs-html, .case article',
            ),
          ];
        });
      } else {
        assert(
          !(await response.text()).includes('id="corpus"'),
          'CSR corpus unexpectedly server rendered',
        );
      }
    } finally {
      release();
    }
    await expect(page.locator('#corpus'))
      .toHaveAttribute('data-ready', 'true', { timeout: 60_000 })
      .catch((error) => {
        throw new Error(
          `${error.message}\nBrowser errors: ${JSON.stringify(errors)}`,
        );
      });
    const after = await inspect();
    const { count, expectedRequests } = after;
    if (before) {
      assert.deepEqual(
        after,
        before,
        'Corpus meaning changed during hydration',
      );
      assert.equal(
        await page.evaluate(() =>
          globalThis.__corpusHosts.every(
            (node, index) =>
              node ===
              document.querySelectorAll(
                '.case aa-editorjs-html, .case .editorjs-html, .case article',
              )[index],
          ),
        ),
        true,
        'Renderer hosts must be hydrated, not recreated',
      );
    }
    assert.equal(count, 1169); // 14 routes × 27 attacks × 3 modes + 30 fragments + 4 alt states + semantics.
    await expect(
      page
        .locator('[data-name="alt/A mountain"] article')
        .getByRole('img', { name: 'A mountain' }),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-name="alt/"] article').getByRole('img'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-name="alt/undefined"] article'),
    ).toBeEmpty();
    await expect(
      page.locator('[data-name="alt/missing-preview"] article'),
    ).toBeEmpty();
    const semantic = page.locator('[data-name="semantics"] article');
    await expect(semantic.locator('ol').first()).toHaveAttribute('start', '3');
    await expect(semantic.locator('ol ol')).toHaveAttribute('type', 'a');
    await expect(semantic.locator('aside pre code')).toHaveText(
      '<script>literal</script>',
    );
    assert.match(await semantic.ariaSnapshot(), /\[Completed\]/);
    assert.equal(await page.evaluate(() => !!globalThis.__executed), false);
    await page.waitForFunction(() =>
      [...document.images].every((image) => image.complete),
    );
    assert.deepEqual(
      [...new Set(requests.filter((url) => /\.invalid\//.test(url)))].sort(),
      expectedRequests,
    );
    assert(
      expectedRequests.every((url) =>
        /^https:\/\/(assets|attack)\.invalid\//.test(url),
      ),
    );
    assert.deepEqual(errors, []);
    return {
      route,
      cases: count,
      presentations: 2,
      serverParity: !!before,
      errors,
    };
  } finally {
    writeFileSync(
      join(evidence, `${route}-browser.json`),
      JSON.stringify({ errors, requests }, null, 2),
    );
    await page
      .context()
      .tracing.stop({ path: join(evidence, `${route}-trace.zip`) });
    await page.close();
  }
}
export async function corpusCheck(browser, origin, evidence) {
  const results = [];
  for (const route of ['corpus', 'corpus-server'])
    results.push(await corpusRoute(browser, origin, route, evidence));
  return { routes: results };
}
export async function isolationCheck(browser, origin, consumer) {
  const output = join(consumer, 'dist/consumer');
  // Angular 22.2 separates browser/server metafiles; earlier cells combine them.
  const statsFiles = existsSync(join(output, 'stats.json'))
    ? ['stats.json']
    : ['browser-stats.json', 'server-stats.json'];
  for (const file of statsFiles)
    assertDisplayInputs(read(join(output, file)).inputs);
  const control = read(join(consumer, 'control-meta.json'));
  assert.throws(() => assertDisplayInputs(control.inputs), /Authoring code/);
  const { page, errors, requests } = await observedPage(browser);
  try {
    for (const route of ['first', 'second', 'csr', 'static']) {
      requests.length = 0;
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      await page.route('**/*.js', async (request) => {
        await gate;
        await request.continue();
      });
      const response = await page.goto(`${origin}/${route}`, {
        waitUntil: 'commit',
      });
      const raw = await response.text();
      let initial;
      if (route === 'csr') {
        assert(
          !raw.includes('id="directive"'),
          'CSR unexpectedly server rendered',
        );
      } else {
        await expect(page.locator('#directive h2')).toBeVisible();
        initial = await page.locator('#directive').innerHTML();
        await page.evaluate(() => {
          globalThis.__initialHost = document.querySelector('#directive');
        });
      }
      release();
      await expect(page.locator('main')).toHaveAttribute(
        'data-hydrated',
        'true',
      );
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const end = () => setTimeout(resolve, 100);
            if ('requestIdleCallback' in window)
              window.requestIdleCallback(end, { timeout: 1000 });
            else end();
          }),
      );
      if (route !== 'csr') {
        assert.equal(await page.locator('#directive').innerHTML(), initial);
        assert.equal(
          await page.evaluate(
            () =>
              globalThis.__initialHost === document.querySelector('#directive'),
          ),
          true,
        );
      }
      await page.unroute('**/*.js');
      assert(
        requests.some((url) => url.endsWith('.js')),
        'No browser script requests observed',
      );
      assert(
        !requests.some((url) => /control|editorjs.*author/i.test(url)),
        'Authoring chunk fetched',
      );
      assert.equal(
        await page.evaluate(() => !!globalThis.__authoringControl),
        false,
      );
      await expect(
        page.locator('.codex-editor, .ce-block, .ce-paragraph'),
      ).toHaveCount(0);
    }
    // The same detector sees real Editor.js, a browser tool and the authoring Angular APF.
    await page.route('**/authoring-control.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: readFileSync(join(consumer, 'control.js'), 'utf8'),
      }),
    );
    await page.addScriptTag({ url: `${origin}/authoring-control.js` });
    assert.deepEqual(await page.evaluate(() => globalThis.__authoringControl), {
      editor: 'function',
      tool: 'function',
      angular: 'function',
    });
    assert(requests.some((url) => url.endsWith('/authoring-control.js')));
    assert.deepEqual(errors, []);
    const bundles = Object.keys(files(join(consumer, 'dist/consumer/browser')))
      .filter((path) => path.endsWith('.js'))
      .map((path) => {
        const bytes = readFileSync(
          join(consumer, 'dist/consumer/browser', path),
        );
        return { path, bytes: bytes.length, gzip: gzipSync(bytes).length };
      });
    return {
      routes: ['first', 'second', 'csr', 'static'],
      negativeControl: true,
      bundles,
      errors,
    };
  } finally {
    await page.close();
  }
}
