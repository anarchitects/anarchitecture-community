import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('packed pure entry', () => {
  let root: string;
  const source = resolve(import.meta.dirname, '..');
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'header-package-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    for (const [name, directory] of [
      ['editorjs-core', '../core'],
      ['editorjs-tool-header', '.'],
    ]) {
      const [pack] = JSON.parse(
        execFileSync(
          'npm',
          ['pack', '--ignore-scripts', '--json', '--pack-destination', root],
          {
            cwd: resolve(source, directory),
            encoding: 'utf8',
            env: { ...process.env, npm_config_cache: join(root, 'cache') },
          },
        ),
      );
      const destination = join(root, 'node_modules/@anarchitects', name);
      mkdirSync(destination, { recursive: true });
      execFileSync('tar', [
        '-xzf',
        join(root, pack.filename),
        '-C',
        destination,
        '--strip-components=1',
      ]);
      if (name === 'editorjs-tool-header') {
        expect(pack.files.map((f: { path: string }) => f.path)).toEqual(
          expect.arrayContaining([
            'README.md',
            'LICENSE',
            'dist/index.js',
            'dist/index.d.ts',
            'dist/browser.js',
            'dist/browser.d.ts',
          ]),
        );
        expect(
          pack.files.some((f: { path: string }) =>
            /^(src|tests)\/|tsbuildinfo/.test(f.path),
          ),
        ).toBe(false);
        expect(readFileSync(join(destination, 'README.md'), 'utf8')).toBe(
          readFileSync(join(source, 'README.md'), 'utf8'),
        );
        const manifest = JSON.parse(
          readFileSync(join(destination, 'package.json'), 'utf8'),
        );
        expect(Object.keys(manifest.exports).sort()).toEqual([
          '.',
          './browser',
          './package.json',
        ]);
        expect(manifest.dependencies).toEqual({
          '@anarchitects/editorjs-core': '^0.0.1',
          '@editorjs/header': '2.8.9',
        });
        expect(manifest.peerDependencies).toEqual({
          '@editorjs/editorjs': '2.31.7',
        });
        expect(manifest.sideEffects).toContain('./dist/browser.js');
        expect(
          readFileSync(join(destination, 'dist/browser.js'), 'utf8'),
        ).toContain('@editorjs/header');
      }
    }
  }, 30_000);
  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('imports without DOM, Editor.js, upstream tool or Angular installed', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      for (const name of ['@angular/core', '@editorjs/editorjs', '@editorjs/header']) assert.throws(() => import.meta.resolve(name));
      for (const name of ['window', 'document']) Object.defineProperty(globalThis, name, { get() { throw new Error(name + ' read'); } });
      const { defineHeaderTool, validateHeaderData } = await import('@anarchitects/editorjs-tool-header');
      let calls = 0;
      defineHeaderTool({ source: 'lazy', load: async () => { calls++; throw new Error('not activated'); } });
      assert.equal(calls, 0);
      assert.equal(validateHeaderData({ text: '<b>pure</b>', level: 2 }).ok, true);
    `,
      ],
      { cwd: root, env: { ...process.env, NODE_OPTIONS: '' }, stdio: 'pipe' },
    );
  });

  it.each(['NodeNext', 'Bundler'])(
    'compiles ES2022-only public declarations under %s',
    (resolution) => {
      writeFileSync(
        join(root, 'consumer.ts'),
        `
      import { defineHeaderTool, validateHeaderData, type HeaderConfig, type HeaderToolOptions, type HeaderData } from '@anarchitects/editorjs-tool-header';
      import { composeToolRegistry, createToolMap, type ToolDataValidator } from '@anarchitects/editorjs-core';
      class Tool { value = 1; }
      const config: HeaderConfig = { levels: [2, 3], defaultLevel: 2 };
      const data: HeaderData = { text: '', level: 2, custom: { retained: true } };
      const definition = defineHeaderTool({ name: 'body', source: 'eager', registration: { class: Tool, config } });
      const name: 'body' = definition.name;
      const ctor: typeof Tool = createToolMap(composeToolRegistry([[definition]], { profile: { tools: [] } })).body.class;
      const validator: ToolDataValidator = validateHeaderData;
      const lazy: HeaderToolOptions = { source: 'lazy', load: async () => Tool };
      // @ts-expect-error defaultLevel must be a supported heading level
      defineHeaderTool({ source: 'lazy', load: async () => Tool, settings: { config: { defaultLevel: 7 } } });
      // @ts-expect-error eager and lazy registration cannot be mixed
      defineHeaderTool({ source: 'lazy', load: async () => Tool, registration: Tool });
      // @ts-expect-error there is no DOM in the pure contract
      let forbidden: HTMLElement;
      void [data, name, ctor, validator, lazy];
    `,
      );
      writeFileSync(
        join(root, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            module: resolution === 'Bundler' ? 'ESNext' : 'NodeNext',
            moduleResolution: resolution,
            target: 'ES2022',
            lib: ['ES2022'],
            types: [],
            strict: true,
            skipLibCheck: false,
            noEmit: true,
          },
          files: ['consumer.ts'],
        }),
      );
      const compilation = spawnSync(
        process.execPath,
        [
          resolve(source, '../../..', 'node_modules/typescript/bin/tsc'),
          '-p',
          join(root, 'tsconfig.json'),
        ],
        { cwd: root, encoding: 'utf8' },
      );
      expect(compilation.status, compilation.stdout + compilation.stderr).toBe(
        0,
      );
    },
  );
});
