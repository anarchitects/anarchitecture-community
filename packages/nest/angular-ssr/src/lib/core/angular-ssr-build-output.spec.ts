import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveAngularSsrBuildOutput } from './angular-ssr-build-output.js';

describe('resolveAngularSsrBuildOutput', () => {
  it('resolves browser output and imports an engine from the server bundle', async () => {
    const root = await createBuildOutput();

    try {
      const resolved = await resolveAngularSsrBuildOutput({
        buildOutput: { root, importStrategy: 'native' },
      });
      const response = await resolved.engine.handle(
        new Request('http://localhost/'),
      );

      expect(resolved.browserAssetsDir).toBe(join(root, 'browser'));
      expect(resolved.serverBundlePath).toBe(join(root, 'server/server.mjs'));
      expect(await response?.text()).toBe('split-workspace SSR');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('supports configurable candidates and engine export names', async () => {
    const root = await createBuildOutput({
      bundlePath: 'custom/runtime.mjs',
      engineExport: 'engine',
    });

    try {
      const resolved = await resolveAngularSsrBuildOutput({
        buildOutput: {
          root,
          serverBundleCandidates: ['custom/runtime.mjs'],
          engineExport: 'engine',
          importStrategy: 'native',
        },
      });

      expect(resolved.engineExport).toBe('engine');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails with an actionable error when browser output is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'angular-build-output-'));

    try {
      await expect(
        resolveAngularSsrBuildOutput({
          buildOutput: { root, importStrategy: 'native' },
        }),
      ).rejects.toThrow('browser assets directory was not found');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails with an actionable error when no engine is exported', async () => {
    const root = await createBuildOutput({ engineExport: null });

    try {
      await expect(
        resolveAngularSsrBuildOutput({
          buildOutput: { root, importStrategy: 'native' },
        }),
      ).rejects.toThrow('does not export an engine named "angularSsrEngine"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createBuildOutput(
  options: {
    bundlePath?: string;
    engineExport?: string | null;
  } = {},
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'angular-build-output-'));
  const bundlePath = options.bundlePath ?? 'server/server.mjs';
  const exportName =
    options.engineExport === undefined
      ? 'angularSsrEngine'
      : options.engineExport;

  await mkdir(join(root, 'browser'), { recursive: true });
  await mkdir(join(root, bundlePath, '..'), { recursive: true });
  await writeFile(join(root, 'browser/index.html'), '<app-root></app-root>');
  await writeFile(
    join(root, bundlePath),
    exportName
      ? `export const ${exportName} = { async handle() { return new Response('split-workspace SSR'); } };`
      : 'export const notAnEngine = true;',
  );

  return root;
}
