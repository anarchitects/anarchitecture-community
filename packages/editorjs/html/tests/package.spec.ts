import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

it('passes the actual Nx publish preflight without publishing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'editorjs-html-publish-'));
  try {
    const output = execFileSync(
      'yarn',
      [
        'nx',
        'release',
        'publish',
        '--projects=editorjs-html',
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
        },
      },
    );
    expect(output).toContain('Would publish to');
    expect(output).toContain('[dry-run]');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 65_000);
