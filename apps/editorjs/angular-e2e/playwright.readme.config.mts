import { defineConfig, devices } from '@playwright/test';

const report = process.env['EDITORJS_README_REPORT'];
const port = process.env['EDITORJS_README_PORT'] || '4335';
if (!report) throw new Error('Run README checks through e2e-packed-ssr');
export default defineConfig({
  testDir: './readme',
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  grepInvert:
    process.env['EDITORJS_README_PROFILE'] === 'full'
      ? /incremental Forms boundary/
      : undefined,
  outputDir: `${report}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${report}/report`, open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tools/readme-server.mjs',
    cwd: import.meta.dirname,
    url: `http://127.0.0.1:${port}/fixture-health`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
