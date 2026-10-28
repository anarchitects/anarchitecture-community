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
    root = mkdtempSync(join(tmpdir(), 'quote-package-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    for (const [name, directory] of [
      ['editorjs-core', '../core'],
      ['editorjs-tool-quote', '.'],
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
      if (name === 'editorjs-tool-quote') {
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
          '@editorjs/quote': '2.7.6',
        });
        expect(manifest.peerDependencies).toEqual({
          '@editorjs/editorjs': '2.31.7',
        });
        expect(manifest.sideEffects).toContain('./dist/browser.js');
        expect(
          readFileSync(join(destination, 'dist/browser.js'), 'utf8'),
        ).toContain('@editorjs/quote');
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
      for (const name of ['@angular/core', '@editorjs/editorjs', '@editorjs/quote']) assert.throws(() => import.meta.resolve(name));
      for (const name of ['window', 'document']) Object.defineProperty(globalThis, name, { get() { throw new Error(name + ' read'); } });
      const { defineQuoteTool, validateQuoteData } = await import('@anarchitects/editorjs-tool-quote');
      let calls = 0;
      defineQuoteTool({ source: 'lazy', load: async () => { calls++; throw new Error('not activated'); } });
      assert.equal(calls, 0);
      assert.equal(validateQuoteData({ text: '<b>pure</b>', caption: '', alignment: 'left' }).ok, true);
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
      import { defineQuoteTool, validateQuoteData, type QuoteConfig, type QuoteToolOptions, type QuoteData } from '@anarchitects/editorjs-tool-quote';
      import { composeToolRegistry, createToolMap, type ToolDataValidator } from '@anarchitects/editorjs-core';
      class Tool { value = 1; }
      const config: QuoteConfig = { quotePlaceholder: '', captionPlaceholder: 'Author', defaultAlignment: 'center' };
      const data: QuoteData = { text: '', caption: '', alignment: 'left', custom: { retained: true } };
      const definition = defineQuoteTool({ name: 'body', source: 'eager', registration: { class: Tool, config } });
      const name: 'body' = definition.name;
      const ctor: typeof Tool = createToolMap(composeToolRegistry([[definition]], { profile: { tools: [] } })).body.class;
      const validator: ToolDataValidator = validateQuoteData;
      const lazy: QuoteToolOptions = { source: 'lazy', load: async () => Tool };
      // @ts-expect-error defaultAlignment must be left or center
      defineQuoteTool({ source: 'lazy', load: async () => Tool, settings: { config: { defaultAlignment: 'right' } } });
      // @ts-expect-error eager and lazy registration cannot be mixed
      defineQuoteTool({ source: 'lazy', load: async () => Tool, registration: Tool });
      // @ts-expect-error saved data requires a caption
      const missingCaption: QuoteData = { text: '', alignment: 'left' };
      // @ts-expect-error saved alignment does not accept arbitrary strings
      const wrongAlignment: QuoteData = { text: '', caption: '', alignment: 'right' };
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
