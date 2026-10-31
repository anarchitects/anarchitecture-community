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
    expect(packedFiles).toContain('LICENSE');
    expect(packedFiles).toContain('custom-tools.md');
    expect(packedFiles).toContain('persistence.md');
    expect(readFileSync(join(packageDirectory, 'persistence.md'), 'utf8')).toBe(
      readFileSync(resolve(import.meta.dirname, '../persistence.md'), 'utf8'),
    );
    expect(
      readFileSync(join(packageDirectory, 'custom-tools.md'), 'utf8'),
    ).toBe(
      readFileSync(resolve(import.meta.dirname, '../custom-tools.md'), 'utf8'),
    );
    expect(readFileSync(join(packageDirectory, 'LICENSE'), 'utf8')).toBe(
      readFileSync(resolve(import.meta.dirname, '../LICENSE'), 'utf8'),
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
          'EDITOR_JS_2_31_7_TOOL_PROFILE',
          'EditorJsDocumentCoordinator',
          'EditorJsOperationError',
          'ToolRegistryError',
          'UploadStoppedError', 'composeImageUploader', 'createUploadOperation',
          'composeToolRegistry', 'createToolMap', 'createToolResolver',
          'normalizeOutputData', 'parseContentWithProvenance', 'parseOutputData', 'validateOutputData',
          'selectToolRegistry', 'validateToolReferences',
        ].sort());
        assert.ok(import.meta.resolve('@anarchitects/editorjs-core').endsWith('/dist/index.js'));
        assert.ok(import.meta.resolve('@anarchitects/editorjs-core/package.json').endsWith('/package.json'));
        const hostFailure = { success: 0, error: new Error('host-owned') };
        const fileResponse = { success: 1, file: { url: '/asset', id: 42 } };
        class Files { async uploadByFile() { assert.equal(this.constructor, Files); return fileResponse; } }
        const uploads = core.composeImageUploader(new Files(), { uploadByUrl: async () => hostFailure });
        assert.equal(await uploads.uploadByFile(new Uint8Array([1])), fileResponse);
        assert.equal(await uploads.uploadByUrl('/source'), hostFailure);
        let uploadAttempts = 0;
        const retrying = core.createUploadOperation(async () => ++uploadAttempts === 1 ? hostFailure : fileResponse, {
          retry: { maxAttempts: 2, replaySafe: true, shouldRetry: outcome => outcome.kind === 'failure', delayMs: 0,
            schedule: resume => { const timer = setTimeout(resume, 0); return () => clearTimeout(timer); } },
        });
        assert.equal(await retrying.result, fileResponse);
        assert.equal(uploadAttempts, 2);
        const stoppedUpload = core.createUploadOperation(() => new Promise(() => {}));
        const stoppedResult = assert.rejects(stoppedUpload.result, error => error instanceof core.UploadStoppedError && error.code === 'stopped');
        await Promise.resolve();
        stoppedUpload.stop();
        await stoppedResult;
        assert.deepEqual(core.parseOutputData('{"blocks":[]}'), { ok: true, data: { blocks: [] } });
        class CustomTool { constructor() { throw new Error('must not construct'); } }
        const registry = core.composeToolRegistry([[{
          name: 'custom', kind: 'block', source: 'eager', registration: CustomTool,
        }, {
          name: 'lazy', kind: 'block', source: 'lazy', load: () => { throw new Error('must not load'); },
        }]], { profile: core.EDITOR_JS_2_31_7_TOOL_PROFILE });
        core.validateToolReferences(registry);
        const selected = core.selectToolRegistry(registry, ['custom']);
        assert.equal(core.createToolMap(selected).custom, CustomTool);
        assert.throws(() => core.createToolMap(registry), error => error instanceof core.ToolRegistryError && error.code === 'unresolved-tool');
        let loads = 0;
        const resolver = core.createToolResolver(core.composeToolRegistry([[{
          name: 'custom', kind: 'block', source: 'lazy',
          load: async () => { loads++; return CustomTool; },
        }]], { profile: core.EDITOR_JS_2_31_7_TOOL_PROFILE }));
        assert.equal(loads, 0);
        const [firstTools, secondTools] = await Promise.all([resolver.resolve(), resolver.resolve()]);
        assert.equal(firstTools.custom.class, CustomTool);
        assert.notEqual(firstTools.custom, secondTools.custom);
        assert.equal((await resolver.resolve()).custom.class, CustomTool);
        assert.equal(loads, 1);
        resolver.dispose();
        await assert.rejects(resolver.resolve(), error => error instanceof core.ToolRegistryError && error.code === 'disposed');
        const pendingResolver = core.createToolResolver(core.composeToolRegistry([[{
          name: 'pending', kind: 'block', source: 'lazy', load: () => new Promise(() => {}),
        }]], { profile: core.EDITOR_JS_2_31_7_TOOL_PROFILE }));
        const pendingResolution = assert.rejects(pendingResolver.resolve(), error => error.code === 'disposed');
        pendingResolver.dispose();
        await pendingResolution;
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
      const blocks = [
        ...readme.matchAll(
          /(?:<!-- browser-example-file: ([\w.-]+) -->\s*)?```ts\n([\s\S]*?)```/g,
        ),
      ];
      // The marked DOM recipe runs in the separate, Angular-free packed host.
      expect(
        blocks.filter((block) => block[1]).map((block) => block[1]),
      ).toEqual(['browser-editor.ts']);
      const examples = blocks.filter((block) => !block[1]);
      expect(examples.length).toBeGreaterThan(0);
      const exampleFiles = examples.map((example, index) => {
        const filename = `readme-${index}.mts`;
        writeFileSync(join(temporaryDirectory, filename), example[2]);
        return filename;
      });
      const guide = readFileSync(
        join(packageDirectory, 'custom-tools.md'),
        'utf8',
      );
      const guideExamples = [
        ...guide.matchAll(
          /<!-- (neutral|browser)-example-file: ([\w.-]+) -->\s*```(?:ts|html)\n([\s\S]*?)```/g,
        ),
      ];
      expect(guideExamples.map(([, , file]) => file)).toEqual([
        'callout-data.ts',
        'callout-tool.ts',
        'callout-direct.ts',
        'callout-lazy.ts',
        'callout-editor.ts',
        'main.ts',
        'index.html',
        'editorial-data.ts',
        'marker-tool.ts',
        'flag-tune.ts',
        'editorial-registry.ts',
        'editorial-main.ts',
        'code-data.ts',
        'code-settings.ts',
        'code-direct.ts',
        'code-lazy.ts',
        'code-main.ts',
        'code.html',
      ]);
      writeFileSync(
        join(temporaryDirectory, 'package.json'),
        '{"type":"module"}',
      );
      for (const [, kind, file, code] of guideExamples) {
        expect(code).not.toMatch(
          /@anarchitecture-community\/source|packages\/editorjs|@angular\//,
        );
        if (kind !== 'neutral') continue;
        writeFileSync(join(temporaryDirectory, file), code);
        exampleFiles.push(file);
      }
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
        const { validateCalloutDocument, requireCalloutDocument, validateCallout } = await import('./compiled-${moduleResolution}/callout-data.js');
        const doc = data => ({ blocks: [{ type: 'callout', data }] });
        assert.deepEqual(requireCalloutDocument(JSON.stringify(doc({text: '', tone: 'info'}))).blocks[0].data, {text: '', tone: 'info'});
        for (const input of ['{', null, { blocks: 'wrong' }, doc({}), doc({text: 1, tone: 'info'}), doc({text: '', tone: 'danger'}), doc({text: ''})])
          assert.equal(validateCalloutDocument(input).ok, false);
        assert.deepEqual(validateCalloutDocument(doc({text: ''})).errors[0].path, ['blocks', 0, 'data', 'tone']);
        assert.equal(validateCalloutDocument({blocks: [{type: 'paragraph', data: {text: 'unknown'}}]}).errors[0].code, 'unknown_tool');
        assert.equal(validateCalloutDocument({blocks: [{type: 'aside', data: {text: '', tone: 'warning'}}]}, 'aside').ok, true);
        assert.equal(validateCalloutDocument({blocks: [{type: 'callout', data: {text: '', tone: 'info'}, tunes: {flag: {flagged: true}}}]}).ok, false);
        assert.equal(validateCallout({text: '<img src=x onerror=alert(1)>', tone: 'info'}, {type: 'callout', blockIndex: 0}).ok, true, 'Schema validation must not be misrepresented as HTML sanitization');
        const { validateEditorialDocument, requireEditorialDocument } = await import('./compiled-${moduleResolution}/editorial-data.js');
        const tuned = (tunes, type = 'callout') => ({blocks: [{type, data: {text: '<mark>Text</mark>', tone: 'info'}, ...(tunes === undefined ? {} : {tunes})}]});
        for (const tunes of [undefined, {}, {flag: {flagged: false}}, {flag: {flagged: true}}]) {
          const input = tuned(tunes);
          assert.deepEqual(requireEditorialDocument(JSON.stringify(input)), input);
        }
        for (const payload of [null, [], true, 'true', {}, {flagged: 'true'}, {flagged: true, extra: 1}]) {
          const result = validateEditorialDocument(tuned({flag: payload}));
          assert.equal(result.ok, false);
          assert.deepEqual(result.errors[0].path, ['blocks', 0, 'tunes', 'flag']);
        }
        assert.equal(validateEditorialDocument(tuned({unknown: {flagged: true}})).ok, false);
        assert.equal(validateEditorialDocument(tuned({}, 'paragraph')).ok, false);
        assert.equal(validateEditorialDocument(tuned({review: {flagged: true}}, 'aside'), 'aside', 'review').ok, true);
        assert.equal(validateEditorialDocument(tuned({flag: {flagged: true}}, 'aside'), 'aside', 'review').ok, false);
        const { requireCodeConfig, requireCodeDocument } = await import('./compiled-${moduleResolution}/code-data.js');
        assert.deepEqual(requireCodeConfig({placeholder: 'Code'}), {placeholder: 'Code'});
        for (const config of [null, [], {}, {placeholder: 1}, {placeholder: '', extra: true}]) assert.throws(() => requireCodeConfig(config));
        const codeDoc = data => ({blocks: [{type: 'code', data}]});
        for (const code of ['', '<script>literal</script>', 'line 1\\nline 2']) assert.deepEqual(requireCodeDocument(JSON.stringify(codeDoc({code}))), codeDoc({code}));
        for (const data of [{}, {code: 1}, {code: '', language: 'js'}]) assert.throws(() => requireCodeDocument(codeDoc(data)));
        assert.throws(() => requireCodeDocument({blocks: [{type: 'code', data: {code: ''}, tunes: {unknown: true}}]}));
        assert.throws(() => requireCodeDocument(codeDoc({code: ''}), 'snippet'));
        assert.equal(requireCodeDocument({blocks: [{type: 'snippet', data: {code: ''}}]}, 'snippet').blocks[0].type, 'snippet');
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
  it.each([
    ['NodeNext', 'NodeNext'],
    ['ESNext', 'Bundler'],
  ])(
    'runs the archived persistence recipes with %s/%s',
    (module, moduleResolution) => {
      const directory = join(
        temporaryDirectory,
        `persistence-${moduleResolution}`,
      );
      mkdirSync(directory);
      writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
      const guide = readFileSync(
        join(packageDirectory, 'persistence.md'),
        'utf8',
      );
      const examples = [
        ...guide.matchAll(
          /<!-- persistence-example-file: ([\w.-]+) -->\s*```(?:ts|js)\n([\s\S]*?)```/g,
        ),
      ];
      expect(examples.map(([, file]) => file)).toEqual([
        'persistence.ts',
        'memory-store.ts',
        'main.mjs',
        'evolution.ts',
        'migration-fixtures.ts',
        'migrate.mjs',
      ]);
      for (const [, file, source] of examples)
        writeFileSync(join(directory, file), source);
      writeFileSync(
        join(directory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module,
            moduleResolution,
            lib: ['ES2022'],
            types: [],
            strict: true,
            skipLibCheck: false,
            outDir: 'compiled',
          },
          files: [
            'persistence.ts',
            'memory-store.ts',
            'evolution.ts',
            'migration-fixtures.ts',
          ],
        }),
      );
      const env = { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' };
      const compilation = spawnSync(
        process.execPath,
        [
          createRequire(import.meta.url).resolve('typescript/bin/tsc'),
          '-p',
          'tsconfig.json',
        ],
        { cwd: directory, encoding: 'utf8', env },
      );
      expect(compilation.error).toBeUndefined();
      expect(compilation.status, compilation.stdout + compilation.stderr).toBe(
        0,
      );
      expect(
        execFileSync(process.execPath, ['main.mjs'], {
          cwd: directory,
          encoding: 'utf8',
          env,
        }).trim(),
      ).toBe(
        [
          'raw: 2 blocks reloaded',
          'record: note-1 at r1; provenance present',
          'write rejected; previous raw content preserved',
        ].join('\n'),
      );
      expect(
        execFileSync(process.execPath, ['migrate.mjs'], {
          cwd: directory,
          encoding: 'utf8',
          env,
        }).trim(),
      ).toBe(
        [
          'legacy: aside.message -> callout.text; stored source unchanged',
          'current: no migration; extensions preserved',
          'future: unsupported; stored source unchanged',
        ].join('\n'),
      );
      writeFileSync(
        join(directory, 'consumer.mjs'),
        readFileSync(
          resolve(import.meta.dirname, 'fixtures/persistence-consumer.mjs'),
        ),
      );
      writeFileSync(
        join(directory, 'migration-consumer.mjs'),
        readFileSync(
          resolve(import.meta.dirname, 'fixtures/migration-consumer.mjs'),
        ),
      );
      const checks = spawnSync(
        process.execPath,
        ['--test', 'consumer.mjs', 'migration-consumer.mjs'],
        {
          cwd: directory,
          encoding: 'utf8',
          env,
        },
      );
      expect(checks.error).toBeUndefined();
      expect(checks.status, checks.stdout + checks.stderr).toBe(0);
    },
    30_000,
  );
});
