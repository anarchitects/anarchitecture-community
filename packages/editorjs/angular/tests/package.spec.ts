import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const workspaceRoot = resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);

describe('published Angular contracts', () => {
  let temporaryDirectory: string;
  let packageDirectory: string;
  let packedFiles: string[];

  function unpackPackage(source: string, name: string): string[] {
    const output = execFileSync(
      'npm',
      [
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        temporaryDirectory,
      ],
      {
        cwd: source,
        encoding: 'utf8',
        env: {
          ...process.env,
          npm_config_cache: join(temporaryDirectory, 'cache'),
        },
      },
    );
    const [archive] = JSON.parse(output) as {
      filename: string;
      files: { path: string }[];
    }[];
    const destination = join(temporaryDirectory, 'node_modules', name);
    mkdirSync(destination, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      join(temporaryDirectory, archive.filename),
      '-C',
      destination,
      '--strip-components=1',
    ]);
    return archive.files.map((file) => file.path);
  }

  beforeAll(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'editorjs-angular-'));
    packedFiles = unpackPackage(
      resolve(workspaceRoot, 'dist/packages/editorjs/angular'),
      '@anarchitects/editorjs-angular',
    );
    unpackPackage(
      resolve(workspaceRoot, 'packages/editorjs/core'),
      '@anarchitects/editorjs-core',
    );
    packageDirectory = join(
      temporaryDirectory,
      'node_modules/@anarchitects/editorjs-angular',
    );
    writeFileSync(
      join(temporaryDirectory, 'package.json'),
      JSON.stringify({ type: 'module', private: true }),
    );
    for (const dependency of [
      '@angular/core',
      '@angular/common',
      '@angular/compiler',
      '@angular/platform-browser',
      '@angular/platform-server',
      'rxjs',
      'tslib',
    ]) {
      const target = join(temporaryDirectory, 'node_modules', dependency);
      mkdirSync(dirname(target), { recursive: true });
      symlinkSync(
        dirname(require.resolve(`${dependency}/package.json`)),
        target,
        'dir',
      );
    }
  }, 30_000);

  afterAll(() => {
    if (temporaryDirectory)
      rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('packs the APF entry point, declarations and current consumer documentation', () => {
    const manifest = JSON.parse(
      readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
    );
    expect(manifest.name).toBe('@anarchitects/editorjs-angular');
    expect(manifest.type).toBe('module');
    expect(manifest.sideEffects).toBe(false);
    expect(Object.keys(manifest.exports).sort()).toEqual([
      '.',
      './package.json',
    ]);
    for (const entry of [
      manifest.module,
      manifest.typings,
      manifest.exports['.'].types,
      manifest.exports['.'].default,
    ]) {
      expect(existsSync(join(packageDirectory, entry))).toBe(true);
    }
    expect(manifest.exports['.'].default).toMatch(/^\.\/fesm2022\/.+\.mjs$/);
    expect(manifest.exports['.'].types).toMatch(/\.d\.ts$/);
    expect(manifest.peerDependencies).toEqual({
      '@angular/common': '^22.0.0',
      '@angular/core': '^22.0.0',
      '@editorjs/editorjs': '^2.31.7',
    });
    const sourceManifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'),
    );
    expect(manifest.dependencies['@anarchitects/editorjs-core']).toBe(
      sourceManifest.dependencies['@anarchitects/editorjs-core'],
    );
    expect(JSON.stringify(manifest.dependencies)).not.toContain('workspace:');
    expect(manifest.devDependencies).toBeUndefined();
    expect(
      packedFiles.some((file) =>
        /(^src\/|^tests\/|\.spec\.|\.tsbuildinfo$)/.test(file),
      ),
    ).toBe(false);
    expect(readFileSync(join(packageDirectory, 'LICENSE'), 'utf8')).toBe(
      readFileSync(join(workspaceRoot, 'LICENSE'), 'utf8'),
    );
    expect(readFileSync(join(packageDirectory, 'README.md'), 'utf8')).toBe(
      readFileSync(resolve(import.meta.dirname, '../README.md'), 'utf8'),
    );
  });

  it('imports the installed artifact without Editor.js installed or browser global access', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      import assert from 'node:assert/strict';
      // Unlinked Angular dependencies need the JIT compiler in a plain Node consumer.
      import '@angular/compiler';
      // Angular itself probes optional DOM globals. Initialize peers in Node first,
      // then guard against any additional access introduced by this package.
      import '@angular/core';
      import '@angular/common';
      assert.equal(typeof window, 'undefined');
      assert.equal(typeof document, 'undefined');
      for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'EditorJS']) {
        Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Browser access: ' + name); } });
      }
      const wrapper = await import('@anarchitects/editorjs-angular');
      assert.deepEqual(Object.keys(wrapper).sort(), ['EDITOR_JS_LOADER', 'EditorJs', 'EditorJsOperationError', 'provideEditorJsLoader']);
      assert.ok(import.meta.resolve('@anarchitects/editorjs-angular').includes('/fesm2022/'));
      assert.throws(() => import.meta.resolve('@editorjs/editorjs'), { code: 'ERR_MODULE_NOT_FOUND' });
      await assert.rejects(import('@anarchitects/editorjs-angular/src/index.ts'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
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

  it('renders the component on the server without Editor.js installed or loader invocation', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      import '@angular/compiler';
      import assert from 'node:assert/strict';
      import { bootstrapApplication } from '@angular/platform-browser';
      import { renderApplication } from '@angular/platform-server';
      import { EditorJs, EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
      let calls = 0;
      const html = await renderApplication((context) => bootstrapApplication(EditorJs, {
        providers: [{ provide: EDITOR_JS_LOADER, useValue: () => { calls++; throw new Error('Server loader invoked'); } }],
      }, context), { document: '<aa-editorjs></aa-editorjs>', url: 'http://localhost/', allowedHosts: ['localhost'] });
      assert.equal(calls, 0);
      assert.match(html, /<aa-editorjs/);
      assert.doesNotMatch(html, /codex-editor/);
      assert.throws(() => import.meta.resolve('@editorjs/editorjs'), { code: 'ERR_MODULE_NOT_FOUND' });
      console.log('server render ok');
    `,
      ],
      {
        cwd: temporaryDirectory,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      },
    );
    expect(output).toContain('server render ok');
  });

  it('compiles a standalone Angular host against packed declarations and core contracts', () => {
    const consumerDirectory = join(temporaryDirectory, 'compiler-consumer');
    mkdirSync(consumerDirectory);
    // Angular peers use the installed test baseline; both Anarchitects packages
    // remain actual unpacked archives, never workspace source aliases.
    for (const dependency of ['@editorjs/editorjs']) {
      const target = join(temporaryDirectory, 'node_modules', dependency);
      mkdirSync(dirname(target), { recursive: true });
      symlinkSync(
        dirname(require.resolve(`${dependency}/package.json`)),
        target,
        'dir',
      );
    }
    writeFileSync(
      join(consumerDirectory, 'consumer.ts'),
      readFileSync(join(import.meta.dirname, 'fixtures/consumer.ts')),
    );
    writeFileSync(
      join(consumerDirectory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'preserve',
          moduleResolution: 'bundler',
          lib: ['ES2022', 'DOM'],
          types: [],
          strict: true,
          skipLibCheck: false,
          experimentalDecorators: true,
          outDir: './compiled',
        },
        angularCompilerOptions: {
          strictTemplates: true,
          strictInjectionParameters: true,
        },
        files: ['consumer.ts'],
      }),
    );
    const compilerManifestPath = require.resolve(
      '@angular/compiler-cli/package.json',
    );
    const compilerManifest = JSON.parse(
      readFileSync(compilerManifestPath, 'utf8'),
    );
    const compilation = spawnSync(
      process.execPath,
      [
        resolve(dirname(compilerManifestPath), compilerManifest.bin.ngc),
        '-p',
        'tsconfig.json',
      ],
      {
        cwd: consumerDirectory,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      },
    );
    expect(compilation.error).toBeUndefined();
    expect(compilation.status, compilation.stdout + compilation.stderr).toBe(0);
    expect(
      readFileSync(join(consumerDirectory, 'compiled/consumer.js'), 'utf8'),
    ).toContain('ɵɵdefineComponent');
  });
});
