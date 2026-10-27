import assert from 'node:assert/strict';
import { test as lifetimeTest, expect } from '../hydration/fixture.js';
import { buildGraph, type BuildGraph } from './build-graph.js';

interface Snapshot {
  label: string;
  runtimeRequests: string[];
  runtimeResponses: string[];
  runtimeEvaluated: string[];
  runtimeHints: string[];
  eagerRoots: string[];
  sessions: { owner: string; events: string[] }[];
}
interface Delivery {
  checkpoint(label: string): Promise<Snapshot>;
  assertPublic(snapshot: Snapshot): void;
}
declare global {
  interface Window {
    isolationHints: string[];
  }
}

export const test = lifetimeTest.extend<{
  eager: boolean;
  graph: BuildGraph;
  delivery: Delivery;
}>({
  eager: [false, { option: true }],
  graph: async ({ eager }, use, testInfo) => {
    const graph = await buildGraph(eager);
    await testInfo.attach('production-output-graph', {
      body: JSON.stringify(graph.report, null, 2),
      contentType: 'application/json',
    });
    await use(graph);
  },
  delivery: async ({ page, graph }, use, testInfo) => {
    const requests: { url: string; type: string }[] = [];
    const responses: { url: string; status: number; link?: string }[] = [];
    const checkpoints: unknown[] = [];
    const evaluated = new Set<string>();
    const runtime = (url: string) => {
      try {
        return [
          ...graph.runtime,
          ...Object.values(graph.tools).flat(),
        ].includes(new URL(url).pathname.slice(1));
      } catch {
        return false;
      }
    };
    page.on('request', (request) =>
      requests.push({ url: request.url(), type: request.resourceType() }),
    );
    page.on('response', (response) =>
      responses.push({
        url: response.url(),
        status: response.status(),
        link: response.headers()['link'],
      }),
    );
    await page.addInitScript(() => {
      const seen = new Set<string>();
      window.isolationHints = [];
      const record = (node: Node) => {
        if (!(node instanceof Element)) return;
        const links = [...node.querySelectorAll('link')];
        if (node instanceof HTMLLinkElement) links.push(node);
        for (const link of links) {
          if (!/(?:modulepreload|preload|prefetch)/.test(link.rel)) continue;
          if (!seen.has(link.href)) {
            seen.add(link.href);
            window.isolationHints.push(link.href);
          }
        }
      };
      new MutationObserver((records) => {
        for (const change of records) {
          record(change.target);
          change.addedNodes.forEach(record);
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['href', 'rel'],
      });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    });
    const checkpoint = async (label: string): Promise<Snapshot> => {
      const coverage = await cdp.send('Profiler.takePreciseCoverage');
      for (const script of coverage.result) {
        if (
          script.functions.some((fn) =>
            fn.ranges.some((range) => range.count > 0),
          )
        )
          evaluated.add(script.url);
      }
      const browser = await page.evaluate(() => ({
        hints: window.isolationHints ?? [],
        scripts: [
          ...document.querySelectorAll<HTMLScriptElement>('script[src]'),
        ].map((script) => script.src),
        resources: performance.getEntriesByType('resource').map((entry) => ({
          name: entry.name,
          initiator: (entry as PerformanceResourceTiming).initiatorType,
        })),
        sessions:
          window.hydrationTest?.sessions.map(({ owner, events }) => ({
            owner,
            events,
          })) ?? [],
      }));
      const headerHints = responses.flatMap((response) =>
        [...(response.link ?? '').matchAll(/<([^>]+)>/g)].map(
          (match) => new URL(match[1], response.url).href,
        ),
      );
      const snapshot = {
        label,
        runtimeRequests: requests.map((r) => r.url).filter(runtime),
        runtimeResponses: responses
          .filter((r) => r.status === 200)
          .map((r) => r.url)
          .filter(runtime),
        runtimeEvaluated: [...evaluated].filter(runtime),
        runtimeHints: [...browser.hints, ...headerHints].filter(runtime),
        sessions: browser.sessions,
        eagerRoots: [...browser.scripts, ...browser.hints, ...headerHints]
          .map((url) => new URL(url).pathname.slice(1))
          .filter((asset) => asset in graph.outputs),
      };
      checkpoints.push({
        ...snapshot,
        requests: [...requests],
        responses: [...responses],
        ...browser,
        executedScripts: [...evaluated],
        runtimeCoverage: coverage.result.filter((script) =>
          runtime(script.url),
        ),
      });
      return snapshot;
    };
    try {
      await use({
        checkpoint,
        assertPublic(snapshot) {
          assert.deepEqual(
            snapshot.runtimeRequests,
            [],
            'Editor.js runtime was requested on the public journey',
          );
          assert.deepEqual(
            snapshot.runtimeEvaluated,
            [],
            'Editor.js runtime executed on the public journey',
          );
          assert.deepEqual(
            snapshot.runtimeHints,
            [],
            'Editor.js runtime was preloaded/prefetched on the public journey',
          );
          graph.assertIsolated(snapshot.eagerRoots);
          assert.deepEqual(
            snapshot.sessions,
            [],
            'Editor loader/owner started on the public journey',
          );
        },
      });
    } finally {
      if (!page.isClosed()) await checkpoint('teardown');
      await testInfo.attach('delivery-and-execution', {
        body: JSON.stringify(checkpoints, null, 2),
        contentType: 'application/json',
      });
      await cdp.detach();
    }
  },
});
export { expect };
