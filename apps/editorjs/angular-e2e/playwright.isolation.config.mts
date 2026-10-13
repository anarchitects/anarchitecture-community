import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

export default defineConfig({
  testDir: './isolation',
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  outputDir: './test-output/isolation/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './test-output/isolation/report', open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4323',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    { name: 'production', suffix: 'default', port: 4323 },
    { name: 'eager-control', suffix: '-eager', port: 4324 },
  ].map(({ name, suffix, port }) => ({
    command: `node apps/editorjs/angular-e2e/tools/hydration-server.mjs ${name} ${suffix} ${port} isolation`,
    url: `http://127.0.0.1:${port}/fixture-health`,
    reuseExistingServer: false,
    timeout: 30_000,
    cwd: workspaceRoot,
    gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 5_000 },
  })),
});
