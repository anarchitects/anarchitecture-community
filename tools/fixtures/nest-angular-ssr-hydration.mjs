import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export async function assertHydration(root, port) {
  const require = createRequire(join(root, 'package.json'));
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromium.executablePath(),
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' ||
        (message.type() === 'warning' && /hydrat|NG05/i.test(message.text()))
      )
        errors.push(message.text());
    });
    // Hold application JavaScript while the server HTML and its inline event
    // capture script load. This proves an actual click before bootstrap.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(/\.m?js(?:\?|$)/, async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit' });
      await page.locator('#replay').waitFor({ state: 'visible' });
      await page.evaluate(() => {
        globalThis.__ssrButton = document.querySelector('#replay');
      });
      assert.equal(
        (await page.locator('#replay').textContent()).trim(),
        'Clicks: 0',
      );
      await page.locator('#replay').click();
      assert.equal(
        (await page.locator('#replay').textContent()).trim(),
        'Clicks: 0',
        'Application bootstrapped before the replay probe',
      );
    } finally {
      release();
    }
    await page.waitForFunction(
      () =>
        document.querySelector('#replay')?.textContent?.trim() === 'Clicks: 1',
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.__ssrButton === document.querySelector('#replay'),
      ),
      true,
      'SSR DOM was replaced instead of hydrated',
    );
    await page.locator('#replay').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#replay')?.textContent?.trim() === 'Clicks: 2',
    );
    assert.deepEqual(errors, [], 'Browser/hydration errors');
    return {
      playwright: require('playwright/package.json').version,
      chromium: browser.version(),
      executable: chromium.executablePath(),
      replayedClicks: 1,
      hydratedClicks: 1,
      retainedSsrNode: true,
    };
  } finally {
    await browser.close();
  }
}
