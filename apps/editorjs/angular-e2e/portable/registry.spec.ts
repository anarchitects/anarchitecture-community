import { test, expect } from '../hydration/fixture.js';
import { behavior, lifetime } from './assertions.js';

test('packed non-Angular host exercises the shared block, inline, tune and built-ins', async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on('request', (request) =>
    requests.push(new URL(request.url()).pathname.slice(1)),
  );
  await page.goto('/');
  await behavior(page, 'portable');
  const graph: { tools: Record<string, string[]> } = await (
    await page.request.get('/registry-graph.json')
  ).json();
  for (const name of ['card', 'marker', 'flag'])
    expect(graph.tools[name].every((file) => requests.includes(file))).toBe(
      true,
    );
  expect(
    graph.tools['unselected'].some((file) => requests.includes(file)),
  ).toBe(false);
  await testInfo.attach('portable-delivery', {
    body: JSON.stringify({ graph, requests }),
    contentType: 'application/json',
  });
  expect(
    await page.evaluate(() => document.querySelector('aa-root')),
  ).toBeNull();
});
test('packed non-Angular host fences failed/pending loads and recreates independent editors', async ({
  page,
}) => {
  await page.goto('/');
  await lifetime(page);
  await expect(
    page.locator('[data-registry-owner="B"] .registry-card'),
  ).toBeVisible();
});
