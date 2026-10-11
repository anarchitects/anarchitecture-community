import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('published package', () => {
  let temporaryDirectory: string;
  let packageDirectory: string;
  let packedFiles: string[];

  beforeAll(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'editorjs-core-'));
    const result = execFileSync(
      'npm',
      [
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        temporaryDirectory,
      ],
      {
        cwd: resolve(import.meta.dirname, '..'),
        encoding: 'utf8',
        env: {
          ...process.env,
          npm_config_cache: join(temporaryDirectory, 'cache'),
        },
      },
    );
    const [archive] = JSON.parse(result) as {
      filename: string;
      files: { path: string }[];
    }[];
    packedFiles = archive.files.map((file) => file.path);
    packageDirectory = join(
      temporaryDirectory,
      'node_modules/@anarchitects/editorjs-core',
    );
    mkdirSync(packageDirectory, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      join(temporaryDirectory, archive.filename),
      '-C',
      packageDirectory,
      '--strip-components=1',
    ]);
  }, 30_000);

  afterAll(() => {
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('ships its public JavaScript and declarations without workspace source or tests', () => {
    const manifest = JSON.parse(
      readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
    );
    expect(manifest.name).toBe('@anarchitects/editorjs-core');
    for (const entry of [
      manifest.main,
      manifest.types,
      manifest.exports['.'].import,
      manifest.exports['.'].types,
    ]) {
      expect(existsSync(join(packageDirectory, entry))).toBe(true);
    }
    expect(packedFiles).toContain('README.md');
    expect(
      packedFiles.some((file) =>
        /(^src\/|^tests\/|\.spec\.|\.tsbuildinfo$)/.test(file),
      ),
    ).toBe(false);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([]);
  });

  it('imports by package name in isolated Node without touching browser globals', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
        import assert from 'node:assert/strict';
        for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'EditorJS']) {
          Object.defineProperty(globalThis, name, {
            configurable: true,
            get() { throw new Error('Unexpected browser global access: ' + name); },
          });
        }
        const core = await import('@anarchitects/editorjs-core');
        assert.equal(typeof core, 'object');
        assert.ok(import.meta.resolve('@anarchitects/editorjs-core').endsWith('/dist/index.js'));
        assert.ok(import.meta.resolve('@anarchitects/editorjs-core/package.json').endsWith('/package.json'));
        console.log('import ok');
      `,
      ],
      {
        cwd: temporaryDirectory,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      },
    );
    expect(output.trim()).toBe('import ok');
  });

  it('compiles a type-only consumer without DOM, Node, or Editor.js declarations', () => {
    writeFileSync(
      join(temporaryDirectory, 'consumer.mts'),
      readFileSync(join(import.meta.dirname, 'fixtures/type-only-consumer.ts')),
    );
    writeFileSync(
      join(temporaryDirectory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022'],
          types: [],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        files: ['consumer.mts'],
      }),
    );
    const require = createRequire(import.meta.url);
    const compilation = spawnSync(
      process.execPath,
      [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'],
      {
        cwd: temporaryDirectory,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      },
    );
    expect(compilation.error).toBeUndefined();
    expect(compilation.status, compilation.stdout + compilation.stderr).toBe(0);
  });
});
