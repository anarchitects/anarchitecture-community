import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Extract actual shipped examples; only bootstrap and controllable host ports are private. */
export async function prepareAngularCustom({ root, report, workspace }) {
  const guide = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-angular/custom-tools.md'),
    'utf8',
  );
  assert.equal(
    guide,
    await readFile(
      join(workspace, 'packages/editorjs/angular/custom-tools.md'),
      'utf8',
    ),
  );
  const examples = [
    ...guide.matchAll(
      /<!-- custom-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.deepEqual(
    examples.map((entry) => entry[1]),
    [
      'custom-definitions.ts',
      'custom-environment.ts',
      'custom-editor.ts',
      'custom-page.ts',
      'custom-form.ts',
    ],
  );
  const directory = join(root, 'examples');
  await mkdir(join(directory, 'custom'), { recursive: true });
  for (const [, file, source] of examples)
    await writeFile(join(directory, file), source);
  const core = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-core/custom-tools.md'),
    'utf8',
  );
  const sources = new Map(
    [
      ...core.matchAll(
        /<!-- (?:neutral|browser)-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
      ),
    ].map(([, file, source]) => [file, source]),
  );
  for (const file of [
    'callout-data.ts',
    'callout-tool.ts',
    'editorial-data.ts',
    'marker-tool.ts',
    'flag-tune.ts',
    'code-data.ts',
    'code-settings.ts',
  ]) {
    assert(sources.has(file), `Missing archived source: ${file}`);
    await writeFile(join(directory, 'custom', file), sources.get(file));
  }
  const lock = JSON.parse(
    await readFile(join(root, 'package-lock.json'), 'utf8'),
  );
  const code = lock.packages['node_modules/@editorjs/code'];
  assert.equal(code.version, '2.9.4');
  assert.equal(
    code.integrity,
    'sha512-c0zyWodNqjL/0WI67sZvACIOFU9IAHG0UeeIpjss8pZGGNBum+UWkh7nKULK0SYvaOrdPdlWWqjuFU1TFA5jUA==',
  );
  await writeFile(
    join(report, 'angular-custom-code.json'),
    JSON.stringify(code, null, 2),
  );
  await cp(directory, join(report, 'angular-custom-examples'), {
    recursive: true,
  });
  // Existing CSR app stays available; these routes exercise the archived components.
  await cp(join(root, 'src/main.ts'), join(root, 'src/main.original.ts'));
  await writeFile(
    join(root, 'src/main.ts'),
    `
    import { bootstrapApplication } from '@angular/platform-browser';
    const mode = new URL(location.href).searchParams.get('custom');
    if (mode === 'forms') {
      const { CustomFormPage, CUSTOM_REVIEW, CUSTOM_PERSIST } = await import('../examples/custom-form');
      document.querySelector('aa-root')!.replaceWith(document.createElement('app-custom-form-page'));
      const port = (url: string) => async (document: unknown, signal: AbortSignal): Promise<boolean> => {
        const response = await fetch(url, { method: 'POST', signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(document) });
        if (!response.ok) throw new Error('Injected host port failure');
        const result: unknown = await response.json();
        if (typeof result !== 'boolean') throw new Error('Invalid host port response');
        return result;
      };
      bootstrapApplication(CustomFormPage, { providers: [
        { provide: CUSTOM_REVIEW, useValue: port('/custom-review') },
        { provide: CUSTOM_PERSIST, useValue: port('/custom-persist') },
      ] }).catch(console.error);
    } else if (mode === 'editors') {
      const { CustomPage } = await import('../examples/custom-page');
      document.querySelector('aa-root')!.replaceWith(document.createElement('app-custom-page'));
      bootstrapApplication(CustomPage).catch(console.error);
    } else await import('./main.original');
  `,
  );
}

export async function checkAngularCustomImports({ root, node, run }) {
  await run(
    node,
    [
      '--input-type=module',
      '--eval',
      `
    import assert from 'node:assert/strict';
    import '@angular/compiler';
    import '@angular/core';
    import '@angular/common';
    for (const name of ['window', 'document', 'navigator', 'HTMLElement'])
      Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Browser access: ' + name); } });
    assert.throws(() => import.meta.resolve('@angular/forms'), { code: 'ERR_MODULE_NOT_FOUND' });
    const { readCustomDocument, validateCustomDocument, initialCustomDocument } = await import('./out-tsc/examples/custom-definitions.js');
    await import('./out-tsc/examples/custom-environment.js');
    await import('./out-tsc/examples/custom-page.js');
    assert.equal(readCustomDocument(initialCustomDocument('neutral')).blocks.length, 2);
    for (const block of [
      { type: 'code', data: { code: 1 } },
      { type: 'callout', data: { text: '', tone: 'bad' } },
      { type: 'callout', data: { text: '', tone: 'info' }, tunes: { flag: { flagged: 1 } } },
      { type: 'code', data: { code: '' }, tunes: { flag: { flagged: true } } },
      { type: 'unknown', data: {} },
    ]) assert.equal(validateCustomDocument({ blocks: [block] }).ok, false);
    console.log('Archived Angular custom sources are inert and Forms-absent; shared validators passed');
  `,
    ],
    root,
  );
}
