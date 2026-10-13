import { resolve, join } from 'node:path';

const workspace = resolve(import.meta.dirname, '../../../..');
export const fixtureRoot = process.env.EDITORJS_SSR_ROOT || workspace;
export const reportRoot =
  process.env.EDITORJS_SSR_REPORT ||
  join(workspace, 'apps/editorjs/angular-e2e/test-output');
export const fixtureNode = process.env.EDITORJS_SSR_NODE || process.execPath;
export const packed = Boolean(process.env.EDITORJS_SSR_ROOT);
export const buildDirectory = (suffix = '') =>
  join(fixtureRoot, `dist/apps/editorjs/angular-host-ssr${suffix}`);
export const reportDirectory = (suite) => join(reportRoot, suite);
export const fixturePort = (offset) => (packed ? 4330 : 4320) + offset;
