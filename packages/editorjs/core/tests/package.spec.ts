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
    expect(readFileSync(join(packageDirectory, 'README.md'), 'utf8')).toBe(
      readFileSync(resolve(import.meta.dirname, '../README.md'), 'utf8'),
    );
    expect(
      packedFiles.some((file) =>
        /(^src\/|^tests\/|\.spec\.|\.tsbuildinfo$)/.test(file),
      ),
    ).toBe(false);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest.optionalDependencies ?? {})).toEqual([]);
    expect(Object.keys(manifest.exports).sort()).toEqual([
      '.',
      './package.json',
    ]);
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
        assert.deepEqual(Object.keys(core).sort(), [
          'EditorJsDocumentCoordinator',
          'EditorJsOperationError',
          'normalizeOutputData', 'parseContentWithProvenance', 'parseOutputData', 'validateOutputData',
        ]);
        assert.ok(import.meta.resolve('@anarchitects/editorjs-core').endsWith('/dist/index.js'));
        assert.ok(import.meta.resolve('@anarchitects/editorjs-core/package.json').endsWith('/package.json'));
        assert.deepEqual(core.parseOutputData('{"blocks":[]}'), { ok: true, data: { blocks: [] } });
        assert.deepEqual(core.normalizeOutputData({ blocks: [], time: undefined }), { ok: true, data: { blocks: [] } });
        assert.deepEqual(core.validateOutputData({ blocks: [] }), { ok: true, data: { blocks: [] } });
        const rejected = core.validateOutputData({ blocks: [{ type: 'custom', data: {} }] }, {
          toolValidators: new Map([['custom', () => ({ ok: false, errors: [{ message: 'Rejected', path: ['field'] }] })]]),
        });
        assert.equal(rejected.ok, false);
        assert.deepEqual(rejected.errors[0].path, ['blocks', 0, 'data', 'field']);
        const raw = { version: '2.20.0', blocks: [] };
        const provenance = { schema: { id: 'example/content', version: 'future' } };
        assert.deepEqual(core.parseContentWithProvenance(raw, provenance), { ok: true, data: raw, provenance });
        let changed;
        const publication = new Promise(resolve => { changed = resolve; });
        const documents = new core.EditorJsDocumentCoordinator({
          driver: { save: async () => raw, render: async () => undefined },
          onChange: changed, onError: error => { throw new Error(String(error.cause)); },
        });
        documents.markReady();
        documents.notifyChange();
        assert.deepEqual(await publication, { data: raw, sequence: 1 });
        assert.deepEqual(await documents.api.save(), raw);
        await documents.api.render({ blocks: [] });
        documents.dispose();
        await assert.rejects(documents.api.save(), error => error instanceof core.EditorJsOperationError && error.code === 'destroyed');
        for (const path of ['src/index.ts', 'dist/index.js', 'dist/lib/json-value.js']) {
          await assert.rejects(import('@anarchitects/editorjs-core/' + path), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
        }
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

  it.each([
    { module: 'NodeNext', moduleResolution: 'NodeNext' },
    { module: 'ESNext', moduleResolution: 'Bundler' },
  ])(
    'compiles public types and README examples with $moduleResolution resolution',
    ({ module, moduleResolution }) => {
      writeFileSync(
        join(temporaryDirectory, 'consumer.mts'),
        readFileSync(
          join(import.meta.dirname, 'fixtures/type-only-consumer.ts'),
        ),
      );
      // Compile the actual published examples, not copies that can drift from docs.
      const readme = readFileSync(join(packageDirectory, 'README.md'), 'utf8');
      const examples = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)];
      expect(examples.length).toBeGreaterThan(0);
      const exampleFiles = examples.map((example, index) => {
        const filename = `readme-${index}.mts`;
        writeFileSync(join(temporaryDirectory, filename), example[1]);
        return filename;
      });
      writeFileSync(
        join(temporaryDirectory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module,
            moduleResolution,
            lib: ['ES2022'],
            types: [],
            strict: true,
            skipLibCheck: false,
            outDir: `compiled-${moduleResolution}`,
          },
          files: ['consumer.mts', ...exampleFiles],
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
      expect(compilation.status, compilation.stdout + compilation.stderr).toBe(
        0,
      );
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `
        import assert from 'node:assert/strict';
        const { savedJson } = await import('./compiled-${moduleResolution}/readme-0.mjs');
        assert.deepEqual(JSON.parse(savedJson), {
          blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Hello' } }],
        });
        console.log('quick start ok');
      `,
        ],
        {
          cwd: temporaryDirectory,
          encoding: 'utf8',
          env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
        },
      );
      expect(output.trim()).toBe('quick start ok');
    },
  );
});
