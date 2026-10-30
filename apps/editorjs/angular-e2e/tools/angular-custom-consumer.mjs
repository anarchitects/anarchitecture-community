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

/** Host-only activation/request plumbing; the archived consumer sources stay unchanged. */
export async function prepareAngularCustomSsr(root) {
  await cp(join(root, '..', 'examples'), join(root, 'examples'), {
    recursive: true,
  });
  await writeFile(
    join(root, 'examples/custom-ssr.ts'),
    `
    import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
    import { ActivatedRoute } from '@angular/router';
    import { RequestState } from '../apps/editorjs/angular-host/src/ssr/request-state';
    import { CustomPage } from './custom-page';
    import { CustomFormPage } from './custom-form';

    @Component({
      selector: 'aa-custom-ssr',
      imports: [CustomPage, CustomFormPage],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: \`
        <p data-testid="marker">{{ state.initial.marker }}</p>
        <button type="button" [disabled]="!hydrated()" (click)="active.set(true)">Activate custom tools</button>
        @if (active()) {
          @if (forms) { <app-custom-form-page /> } @else { <app-custom-page /> }
        }
      \`,
    })
    export class CustomSsrPage {
      readonly state = new RequestState();
      readonly forms = inject(ActivatedRoute).snapshot.data['customForms'] === true;
      readonly active = signal(false);
      readonly hydrated = signal(false);
      constructor() { afterNextRender(() => this.hydrated.set(true)); }
    }
  `,
  );
  const host = join(root, 'apps/editorjs/angular-host/src');
  const config = join(host, 'ssr/app.config.ts');
  const original = await readFile(config, 'utf8');
  assert(original.includes('const routes: Routes = ['));
  await writeFile(
    config,
    original.replace(
      'const routes: Routes = [',
      `const routes: Routes = [
    { path: 'custom', loadComponent: () => import('../../../../../examples/custom-ssr').then(m => m.CustomSsrPage) },
    { path: 'custom-forms', data: { customForms: true }, loadComponent: () => import('../../../../../examples/custom-ssr').then(m => m.CustomSsrPage) },
  `,
    ),
  );
  const app = join(host, 'ssr/app.ts');
  await writeFile(
    app,
    (await readFile(app, 'utf8')).replace(
      '<nav aria-label="Fixture routes">',
      '<nav aria-label="Fixture routes"><a routerLink="/custom">Custom tools</a><a routerLink="/custom-forms">Custom Forms</a>',
    ),
  );
  const eager = join(host, 'isolation/main.eager.ts');
  await writeFile(
    eager,
    (await readFile(eager, 'utf8')) +
      `
    import { CalloutTool } from '../../../../../examples/custom/callout-tool';
    import { MarkerTool } from '../../../../../examples/custom/marker-tool';
    import { FlagTune } from '../../../../../examples/custom/flag-tune';
    import Code from '@editorjs/code';
    Object.assign(window, { customEagerTools: [CalloutTool, MarkerTool, FlagTune, Code] });
  `,
  );
}
