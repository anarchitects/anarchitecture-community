import { test as base, expect, type Page } from '@playwright/test';

type Point = 'load' | 'ready' | 'save';
export interface Plan {
  owner: string;
  point: Point;
  fail?: boolean;
}
interface Session {
  owner: string;
  events: string[];
  held?: Point;
  snapshot?: unknown;
  release?: () => void;
  notify?: () => void;
  holder?: HTMLElement;
  detached?: HTMLElement;
}
interface Bridge {
  plans: Plan[];
  sessions: Session[];
  unhandled: string[];
  nodes: Element[];
  enter(owner: string): {
    wait(point: Point, data?: unknown): Promise<void>;
    record(event: string): void;
    captureChange(notify: () => void): void;
    captureHolder(holder: HTMLElement): void;
  };
}
declare global {
  interface Window {
    hydrationTest: Bridge;
  }
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const diagnostics: string[] = [];
    const messages: string[] = [];
    page.on('pageerror', (error) => diagnostics.push(error.message));
    page.on('console', (message) => {
      messages.push(message.text());
      if (
        message.type() === 'error' ||
        /NG05\d+|hydration.*(mismatch|failed|skipped)/i.test(message.text())
      ) {
        diagnostics.push(message.text());
      }
    });
    await page.addInitScript(() => {
      const bridge: Bridge = {
        plans: [],
        sessions: [],
        unhandled: [],
        nodes: [],
        enter(owner) {
          const session: Session = { owner, events: ['load-start'] };
          bridge.sessions.push(session);
          return {
            async wait(point, data) {
              const index = bridge.plans.findIndex(
                (p) => p.owner === owner && p.point === point,
              );
              if (index < 0) return;
              const [plan] = bridge.plans.splice(index, 1);
              session.held = point;
              session.snapshot = structuredClone(data);
              await new Promise<void>((resolve, reject) => {
                session.release = () => {
                  session.events.push(
                    `${point}-${plan.fail ? 'rejected' : 'released'}`,
                  );
                  session.held = undefined;
                  session.release = undefined;
                  if (plan.fail) reject(new Error(`Injected ${point} failure`));
                  else resolve();
                };
              });
            },
            record(event) {
              session.events.push(event);
            },
            captureChange(notify) {
              session.notify = notify;
            },
            captureHolder(holder) {
              session.holder = holder;
            },
          };
        },
      };
      window.hydrationTest = bridge;
      Object.assign(window, { editorLifetimeProbe: bridge });
      window.addEventListener('unhandledrejection', (e) =>
        bridge.unhandled.push(String(e.reason)),
      );
    });
    await use(page);
    if (!page.isClosed()) {
      const evidence = await page.evaluate(() => ({
        sessions: window.hydrationTest?.sessions.map(
          ({ owner, events, held, snapshot }) => ({
            owner,
            events,
            held,
            snapshot,
          }),
        ),
        unhandled: window.hydrationTest?.unhandled ?? [],
      }));
      await testInfo.attach('lifetime-evidence', {
        body: JSON.stringify(
          {
            ...evidence,
            diagnostics,
            messages,
            browser: page.context().browser()?.version(),
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      // eslint-disable-next-line playwright/no-standalone-expect -- Auto fixture teardown is part of every test.
      expect(evidence.unhandled, 'unhandled promise rejections').toEqual([]);
    }
    // eslint-disable-next-line playwright/no-standalone-expect -- Auto fixture teardown is part of every test.
    expect(diagnostics, 'browser errors and hydration diagnostics').toEqual([]);
  },
});
export { expect };
export const card = (page: Page, owner = 'A') =>
  page.locator(`aa-standalone-editor[data-owner="${owner}"]`);
export const paragraph = (page: Page, owner = 'A') =>
  card(page, owner).locator('.ce-paragraph');
export async function events(page: Page, index = 0): Promise<string[]> {
  return page.evaluate(
    (i) => window.hydrationTest.sessions[i]?.events ?? [],
    index,
  );
}
export async function held(page: Page, point: Point, index = 0): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((i) => window.hydrationTest.sessions[i]?.held, index),
    )
    .toBe(point);
}
export async function release(page: Page, index = 0): Promise<void> {
  await page.evaluate((i) => {
    const resume = window.hydrationTest.sessions[i]?.release;
    if (!resume) throw new Error('Expected a held operation');
    resume();
  }, index);
}
export async function arm(page: Page, plan: Plan): Promise<void> {
  await page.evaluate((p) => window.hydrationTest.plans.push(p), plan);
}
export async function ready(page: Page, owner = 'A'): Promise<void> {
  await expect(card(page, owner).getByTestId('ready-count')).toHaveText('1');
}

/** Capture real parsed SSR nodes while every bootstrap/dependency script is held. */
export async function bootstrap(
  page: Page,
  path: string,
  plans: Plan[] = [],
  holders = 1,
  beforeBootstrap?: () => Promise<void>,
): Promise<void> {
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route('**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  const response = await page.goto(path, { waitUntil: 'commit' });
  if (!response) throw new Error('Expected an SSR response');
  expect(response.status()).toBe(200);
  await expect(page.locator('aa-root main')).toBeAttached();
  await expect(page.locator('aa-editorjs > div')).toHaveCount(holders);
  if (holders)
    await expect(page.locator('aa-editorjs > div').first()).toBeEmpty();
  await page.evaluate((plans) => {
    window.hydrationTest.plans.push(...plans);
    window.hydrationTest.nodes = [
      ...document.querySelectorAll('aa-root, aa-editorjs, aa-editorjs > div'),
    ];
  }, plans);
  await test.info().attach('server-html', {
    body: await response.text(),
    contentType: 'text/html',
  });
  try {
    await beforeBootstrap?.();
  } finally {
    resume();
  }
  await page.waitForLoadState('load');
}
export async function retained(page: Page): Promise<void> {
  expect(
    await page.evaluate(() =>
      window.hydrationTest.nodes.every(
        (node) =>
          node.isConnected &&
          (node.matches('aa-root')
            ? node === document.querySelector('aa-root')
            : node.matches('aa-editorjs')
              ? node === document.querySelector('aa-editorjs')
              : node === document.querySelector('aa-editorjs > div')),
      ),
    ),
  ).toBe(true);
}
