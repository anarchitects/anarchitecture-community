import { test, expect } from '../hydration/fixture.js';
import { commonBehavior, commonLifetime } from './common-assertions.js';

test('five packed tools share a framework-free consumer and preserve authored image semantics', async ({
  page,
}) => {
  await page.goto('/?common');
  await commonBehavior(page);
  expect(await page.locator('aa-root').count()).toBe(0);
});
test('five-tool owners fence pending uploads and lazy failures across recreation', async ({
  page,
}) => {
  await page.goto('/?common');
  await commonLifetime(page);
  await expect(page.locator('[data-registry-owner="B"] .ce-block')).toHaveCount(
    5,
  );
});
test('explicit packaged paragraph selection leaves four real tools undelivered', async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(new URL(r.url()).pathname.slice(1)));
  await page.goto('/?common&only=paragraph');
  await expect(page.getByTestId('registry-ready').first()).toHaveText('1');
  await expect(page.getByTestId('registry-ready').last()).toHaveText('1');
  const graph: { commonTools: Record<string, string[]> } = await (
    await page.request.get('/registry-graph.json')
  ).json();
  for (const [name, chunks] of Object.entries(graph.commonTools))
    expect(chunks.some((file) => requests.includes(file))).toBe(
      name === 'paragraph',
    );
  expect(await page.evaluate(() => window.registryProbe?.evaluated)).toEqual([
    'common-paragraph',
  ]);
  await testInfo.attach('selected-tool-delivery', {
    body: JSON.stringify({ graph, requests }),
    contentType: 'application/json',
  });
});
