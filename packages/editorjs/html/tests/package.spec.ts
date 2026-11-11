import { execFile, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('packs npm dependencies accepted by Nx Release without Yarn rewriting', () => {
  const directory = mkdtempSync(join(tmpdir(), 'editorjs-html-npm-'));
  const project = resolve(import.meta.dirname, '..');
  try {
    const [archive] = JSON.parse(
      execFileSync(
        'npm',
        ['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
        {
          cwd: project,
          encoding: 'utf8',
          env: { ...process.env, npm_config_cache: join(directory, 'cache') },
        },
      ),
    ) as { filename: string; files: { path: string }[] }[];
    const manifest = JSON.parse(
      execFileSync(
        'tar',
        ['-xOf', join(directory, archive.filename), 'package/package.json'],
        {
          encoding: 'utf8',
        },
      ),
    );
    const source = JSON.parse(
      readFileSync(join(project, 'package.json'), 'utf8'),
    );
    expect(manifest.version).toBe(source.version);
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@anarchitects/editorjs-core',
      'sanitize-html',
    ]);
    expect(manifest.dependencies['sanitize-html']).toBe('2.18.1');
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const range of Object.values(manifest[field] ?? {})) {
        expect(range).not.toMatch(/^(?:workspace|file|link|portal):/);
      }
    }
    const files = archive.files.map(({ path }) => path);
    expect(files).toEqual(
      expect.arrayContaining([
        'README.md',
        'LICENSE',
        manifest.exports['.'].types.replace(/^\.\//, ''),
        manifest.exports['.'].import.replace(/^\.\//, ''),
      ]),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);

it('passes the actual Nx publish preflight against an isolated registry without publishing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'editorjs-html-publish-'));
  const writes: string[] = [];
  // npm may check version availability even during publish --dry-run. Live
  // registry state must not decide the outcome of this cacheable package test.
  const registry = createServer((request, response) => {
    if (request.method !== 'GET')
      writes.push(`${request.method} ${request.url}`);
    response.writeHead(request.method === 'GET' ? 404 : 405, {
      'content-type': 'application/json',
    });
    response.end(JSON.stringify({ error: 'Not found' }));
  });
  try {
    registry.listen(0, '127.0.0.1');
    await once(registry, 'listening');
    const address = registry.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a local registry TCP address');
    }
    const registryUrl = `http://127.0.0.1:${address.port}/`;
    // Keep the event loop available to answer registry requests from npm.
    const { stdout: output } = await promisify(execFile)(
      'yarn',
      [
        'nx',
        'release',
        'publish',
        '--projects=editorjs-html',
        `--registry=${registryUrl}`,
        '--dry-run',
        '--yes',
        '--skipSync',
        '--outputStyle=static',
      ],
      {
        cwd: resolve(import.meta.dirname, '../../../..'),
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          NX_DRY_RUN: 'true',
          NX_NO_CLOUD: 'true',
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_NATIVE_COMMAND_RUNNER: 'false',
          npm_config_cache: join(directory, 'cache'),
          npm_config_userconfig: join(directory, 'npmrc'),
          npm_config_registry: registryUrl,
        },
      },
    );
    expect(output).toContain(`Would publish to ${registryUrl}`);
    expect(output).toContain('[dry-run]');
    expect(writes).toEqual([]);
  } finally {
    try {
      if (registry.listening) {
        await new Promise<void>((resolve, reject) => {
          registry.close((error) => (error ? reject(error) : resolve()));
        });
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}, 65_000);
