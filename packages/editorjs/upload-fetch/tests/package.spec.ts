import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { packConsumer, source, workspace } from './pack.mjs';
let root: string;
let packed: Map<string, { files: { path: string }[] }>;
beforeAll(() => {
  ({ root, packed } = packConsumer());
}, 60_000);
afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});
it('ships only public browser declarations/runtime and the actual guide/license', () => {
  const archive = packed.get('@anarchitects/editorjs-upload-fetch');
  if (!archive) throw new Error('Missing upload archive');
  const paths = archive.files.map((f) => f.path);
  expect(paths).toEqual(
    expect.arrayContaining([
      'README.md',
      'nest-example.md',
      'LICENSE',
      'dist/browser.js',
      'dist/browser.d.ts',
    ]),
  );
  expect(paths.some((p) => /^(tests|src)\/|tsbuildinfo/.test(p))).toBe(false);
  const installed = join(
    root,
    'node_modules/@anarchitects/editorjs-upload-fetch',
  );
  expect(readFileSync(join(installed, 'README.md'), 'utf8')).toBe(
    readFileSync(join(source, 'README.md'), 'utf8'),
  );
  expect(readFileSync(join(installed, 'nest-example.md'), 'utf8')).toBe(
    readFileSync(join(source, 'nest-example.md'), 'utf8'),
  );
  const manifest = JSON.parse(
    readFileSync(join(installed, 'package.json'), 'utf8'),
  );
  expect(Object.keys(manifest.exports).sort()).toEqual([
    './browser',
    './package.json',
  ]);
  expect(manifest.dependencies).toEqual({
    '@anarchitects/editorjs-core': '^0.0.1',
  });
  expect(manifest.peerDependencies).toBeUndefined();
  expect(manifest.version).toBe('0.0.1');
});
it('imports and constructs without browser globals or framework/editor packages installed', () => {
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    for (const name of ['@angular/core', '@nestjs/core', '@editorjs/editorjs', '@editorjs/image']) assert.throws(() => import.meta.resolve(name));
    // Initialize Node's lazy Web API bindings before installing read guards.
    void globalThis.FormData; void globalThis.Response;
    for (const name of ['window','document','fetch','Blob','File','FormData','AbortController','URL','Request','Response','Headers'])
      Object.defineProperty(globalThis, name, {get() { throw new Error(name + ' read'); }});
    const api = await import('@anarchitects/editorjs-upload-fetch/browser');
    assert.deepEqual(Object.keys(api).sort(), ['FetchUploadError', 'createFetchFileUploader', 'createFetchUrlUploader']);
    const options = {request() { throw new Error('not invoked'); }, decode() { return {success:0}; }};
    assert.equal(typeof api.createFetchFileUploader(options).uploadByFile, 'function');
    assert.equal(typeof api.createFetchUrlUploader(options).uploadByUrl, 'function');
    await assert.rejects(import('@anarchitects/editorjs-upload-fetch'), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  `,
    ],
    { cwd: root, env: { ...process.env, NODE_OPTIONS: '' }, stdio: 'pipe' },
  );
});
it.each(['NodeNext', 'Bundler'])(
  'compiles packed public types and direct-use examples under %s',
  (resolution) => {
    const readme = readFileSync(
      join(root, 'node_modules/@anarchitects/editorjs-upload-fetch/README.md'),
      'utf8',
    );
    const files: string[] = [];
    for (const [, name, code] of readme.matchAll(
      /<!-- upload-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    )) {
      if (name === 'editor.ts') continue; // Compiled with installed optional ImageTool in the browser consumer.
      files.push(name);
      writeFileSync(join(root, name), code);
    }
    expect(files).toEqual(['uploads.ts', 'retry.ts']);
    writeFileSync(
      join(root, 'types.ts'),
      `
    import { createFetchFileUploader, type FetchUploadOptions, type FetchUploadRequest, type FetchUploadResponseContext, type FetchUploadErrorCode } from '@anarchitects/editorjs-upload-fetch/browser';
    import { type FileUploader, type UploadedFile } from '@anarchitects/editorjs-core';
    interface Asset extends UploadedFile { id: string; }
    const options: FetchUploadOptions<Blob, Asset, {denied: boolean}> = {request: () => ({url:'/upload'}), decode: () => ({success:1,file:{url:'x',id:'id'}})};
    const port: FileUploader<Blob, Asset, {denied: boolean}> = createFetchFileUploader(options);
    // @ts-expect-error no fabricated URL capability
    port.uploadByUrl('x');
    // @ts-expect-error Blob input cannot be narrowed to strings
    port.uploadByFile('x');
    const request: FetchUploadRequest = {url:'/upload',init:{signal:new AbortController().signal}};
    const code: FetchUploadErrorCode = 'timeout';
    function status(context: FetchUploadResponseContext) { return context.status; }
    void [port, request, code, status];
  `,
    );
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: resolution === 'Bundler' ? 'ESNext' : 'NodeNext',
          moduleResolution: resolution,
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          types: [],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        files: [...files, 'types.ts'],
      }),
    );
    execFileSync(
      process.execPath,
      [
        join(workspace, 'node_modules/typescript/bin/tsc'),
        '-p',
        join(root, 'tsconfig.json'),
      ],
      { cwd: root, stdio: 'pipe' },
    );
  },
);
