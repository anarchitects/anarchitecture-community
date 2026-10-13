import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';
import { reportDirectory, fixturePort } from './tools/ssr-environment.mjs';

export default defineConfig({
  testDir: './isolation',
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  outputDir: `${reportDirectory('isolation')}/results`,
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: `${reportDirectory('isolation')}/report`, open: 'never' },
    ],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${fixturePort(3)}`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    { name: 'production', suffix: 'default', port: fixturePort(3) },
    { name: 'eager-control', suffix: '-eager', port: fixturePort(4) },
  ].map(({ name, suffix, port }) => ({
    command: `node apps/editorjs/angular-e2e/tools/hydration-server.mjs ${name} ${suffix} ${port} isolation`,
    url: `http://127.0.0.1:${port}/fixture-health`,
    reuseExistingServer: false,
    timeout: 30_000,
    cwd: workspaceRoot,
    gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 5_000 },
  })),
});
