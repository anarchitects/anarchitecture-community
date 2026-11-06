import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('packs installable npm runtime dependencies without Yarn rewriting', () => {
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
