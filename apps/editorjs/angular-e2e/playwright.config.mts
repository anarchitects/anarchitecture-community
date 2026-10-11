import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = 'http://127.0.0.1:4317';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  // One host/server per invocation; test pages and editor state stay isolated.
  workers: process.env['CI'] ? 2 : undefined,
  retries: process.env['CI'] ? 1 : 0,
  forbidOnly: !!process.env['CI'],
  outputDir: './test-output/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './test-output/report', open: 'never' }],
  ],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'yarn nx run editorjs-angular-host:serve-static',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    cwd: workspaceRoot,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
