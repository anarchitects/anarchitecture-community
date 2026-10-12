import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

const cells = [
  { name: 'production', suffix: '', port: 4320 },
  { name: 'diagnostic', suffix: '-diagnostic', port: 4321 },
  { name: 'full', suffix: '-full', port: 4322 },
];
export default defineConfig({
  testDir: './hydration',
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  outputDir: './test-output/hydration/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './test-output/hydration/report', open: 'never' }],
  ],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: cells.map(({ name, suffix, port }) => ({
    command: `node apps/editorjs/angular-e2e/tools/hydration-server.mjs ${name} ${suffix || 'default'} ${port}`,
    url: `http://127.0.0.1:${port}/fixture-health`,
    reuseExistingServer: false,
    timeout: 30_000,
    cwd: workspaceRoot,
    gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 5_000 },
  })),
  projects: cells.map(({ name, suffix, port }) => ({
    name,
    testIgnore: name === 'full' ? '**/*deferred.spec.ts' : [],
    metadata: {
      buildDirectory: `dist/apps/editorjs/angular-host-ssr${suffix}`,
    },
    use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${port}` },
  })),
});
