import { defineConfig } from '@playwright/test';
import base from './playwright.config.mts';

const root = process.env['EDITORJS_PACKED_ROOT'];
const node = process.env['EDITORJS_PACKED_NODE'];
const report = process.env['EDITORJS_PACKED_REPORT'];
if (!root || !node || !report)
  throw new Error(
    'Run the e2e-packed Nx target to prepare an isolated consumer.',
  );
// Paths come from the environment rather than being interpolated into shell code.
// Spread first: defineConfig(base, overrides) would retain both web servers.
export default defineConfig({
  ...base,
  outputDir: `${report}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${report}/report`, open: 'never' }],
  ],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4318' },
  webServer: {
    command: '"$EDITORJS_PACKED_NODE" server.mjs',
    cwd: root,
    url: 'http://127.0.0.1:4318',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
